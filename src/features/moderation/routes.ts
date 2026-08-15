// @ts-nocheck
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { adminRequired, memberRequired } from '../../lib/http';
import { publicUser, adminUser } from '../../lib/auth';
import { reportSchema } from '../../lib/schemas';
import { logAdminAction } from '../../lib/audit';
import { isBlockedEitherWay } from '../../lib/membership';

export function createModerationRouter({ db }) {
  const router = express.Router();

  function audit(req, action, targetType, targetId, details = '') {
    return logAdminAction(db, { adminId: req.user.id, action, targetType, targetId, details });
  }

  async function count(sql, ...params) {
    const row = await db.get(sql, ...params);
    return Number(row?.c || 0);
  }

  // ── Reports (user-facing) ──

  router.post('/reports/posts/:id', memberRequired, async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const post = await db.get('SELECT id, user_id FROM posts WHERE id = ?', req.params.id);
    if (!post || await isBlockedEitherWay(db, req.user.id, post.user_id)) return res.status(404).json({ error: 'Post not found' });
    const result = await db.run('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)', req.user.id, 'post', post.id, parsed.data.reason);
    res.status(201).json({ report: await db.get('SELECT * FROM reports WHERE id = ?', result.lastInsertRowid) });
  });

  router.post('/reports/users/:id', memberRequired, async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const target = await db.get('SELECT id FROM users WHERE id = ? AND is_suspended = 0', req.params.id);
    if (!target || target.id === req.user.id) return res.status(404).json({ error: 'User not found' });
    const result = await db.run('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)', req.user.id, 'user', target.id, parsed.data.reason);
    res.status(201).json({ report: await db.get('SELECT * FROM reports WHERE id = ?', result.lastInsertRowid) });
  });

  router.post('/reports/messages/:id', memberRequired, async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const message = await db.get('SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)', req.params.id, req.user.id, req.user.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const result = await db.run('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)', req.user.id, 'message', message.id, parsed.data.reason);
    res.status(201).json({ report: await db.get('SELECT * FROM reports WHERE id = ?', result.lastInsertRowid) });
  });

  // ── Admin: dashboard stats ──

  router.get('/admin/stats', adminRequired, async (_req, res) => {
    const [users, admins, suspended, blocked, posts, hiddenPosts, reportsOpen, reportsResolved,
      reportsDismissed, commentsTotal, messagesTotal, followsTotal, uploadsTotal, bookmarksTotal, auditLogTotal] = await Promise.all([
      count('SELECT COUNT(*) AS c FROM users'),
      count('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1'),
      count('SELECT COUNT(*) AS c FROM users WHERE is_suspended = 1'),
      count('SELECT COUNT(*) AS c FROM blocks'),
      count('SELECT COUNT(*) AS c FROM posts'),
      count('SELECT COUNT(*) AS c FROM posts WHERE is_hidden = 1'),
      count("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'"),
      count("SELECT COUNT(*) AS c FROM reports WHERE status = 'resolved'"),
      count("SELECT COUNT(*) AS c FROM reports WHERE status = 'dismissed'"),
      count('SELECT COUNT(*) AS c FROM comments'),
      count('SELECT COUNT(*) AS c FROM messages'),
      count('SELECT COUNT(*) AS c FROM follows'),
      count('SELECT COUNT(*) AS c FROM media'),
      count('SELECT COUNT(*) AS c FROM bookmarks'),
      count('SELECT COUNT(*) AS c FROM activity_log')
    ]);

    res.json({
      users, admins, suspended, blocked,
      posts, hiddenPosts,
      reportsOpen, reportsResolved, reportsDismissed,
      commentsTotal, messagesTotal, followsTotal, uploadsTotal,
      bookmarksTotal, auditLogTotal
    });
  });

  // ── Admin: activity log ──

  router.get('/admin/log', adminRequired, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const entries = await db.all(`
      SELECT activity_log.*, users.username AS admin_username
      FROM activity_log
      LEFT JOIN users ON users.id = activity_log.admin_id
      ORDER BY activity_log.created_at DESC
      LIMIT ?
    `, limit);
    res.json({ entries });
  });

  // ── Admin: list all posts ──

  router.get('/admin/posts', adminRequired, async (req, res) => {
    const hideFilter = req.query.hidden;
    const search = String(req.query.q || '').trim();
    let where = '1=1';
    const params: any[] = [];

    if (hideFilter === '1') { where += ' AND posts.is_hidden = 1'; }
    else if (hideFilter === '0') { where += ' AND posts.is_hidden = 0'; }

    if (search) {
      where += ' AND (posts.body LIKE ? OR users.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const posts = await db.all(`
      SELECT posts.*, users.username, users.avatar_url, media.url AS media_url, media.mime_type AS media_type,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
      FROM posts
      JOIN users ON users.id = posts.user_id
      LEFT JOIN media ON media.id = posts.media_id
      WHERE ${where}
      ORDER BY posts.created_at DESC, posts.id DESC
      LIMIT 100
    `, ...params);

    res.json({ posts });
  });

  // ── Admin: edit post content (PATCH) ──

  router.patch('/admin/posts/:id', adminRequired, async (req, res) => {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const body = String(req.body.body ?? post.body).trim();
    if (!body) return res.status(400).json({ error: 'Post body cannot be empty' });
    await db.run('UPDATE posts SET body = ?, edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', body, post.id);
    await audit(req, 'edit_post', 'post', post.id, `Body edited by admin`);
    res.json({ ok: true });
  });

  // ── Admin: list all users ──

  router.get('/admin/users', adminRequired, async (_req, res) => {
    const users = await db.all(`
      SELECT id, username, email, bio, avatar_url, cover_url,
        email_verified, is_admin, is_suspended, created_at,
        (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS post_count,
        (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id) AS follower_count,
        (SELECT COUNT(*) FROM blocks WHERE blocks.blocked_id = users.id) AS blocked_by_count
      FROM users ORDER BY created_at DESC
    `);
    res.json({
      users: users.map((u) => ({
        ...u,
        email_verified: Boolean(u.email_verified),
        is_admin: Boolean(u.is_admin),
        is_suspended: Boolean(u.is_suspended)
      }))
    });
  });

  // ── Admin: edit user ──

  router.patch('/admin/users/:id', adminRequired, async (req, res) => {
    if (Number(req.params.id) === req.user.id && req.body.is_admin === false) {
      return res.status(400).json({ error: 'You cannot remove your own admin status' });
    }
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const username = req.body.username ?? user.username;
    const email = req.body.email ?? user.email;
    const bio = req.body.bio ?? user.bio;
    const isAdmin = req.body.is_admin !== undefined ? (req.body.is_admin ? 1 : 0) : user.is_admin;
    const isSuspended = req.body.is_suspended !== undefined ? (req.body.is_suspended ? 1 : 0) : user.is_suspended;

    await db.run('UPDATE users SET username = ?, email = ?, bio = ?, is_admin = ?, is_suspended = ? WHERE id = ?',
      username, email, bio, isAdmin, isSuspended, user.id);

    const updated = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    const changed: any[] = [];
    if (username !== user.username) changed.push('username');
    if (email !== user.email) changed.push('email');
    if (Number(isAdmin) !== user.is_admin) changed.push(`is_admin:${isAdmin ? 'promote' : 'demote'}`);
    if (Number(isSuspended) !== user.is_suspended) changed.push(`suspend:${isSuspended}`);
    await audit(req, 'edit_user', 'user', user.id, changed.join(', '));

    res.json({ user: adminUser(updated) });
  });

  // ── Admin: suspend / unsuspend user ──

  router.post('/admin/users/:id/suspend', adminRequired, async (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend yourself' });
    const result = await db.run('UPDATE users SET is_suspended = 1 WHERE id = ?', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    await audit(req, 'suspend_user', 'user', Number(req.params.id));
    res.json({ ok: true, suspended: true });
  });

  router.post('/admin/users/:id/unsuspend', adminRequired, async (req, res) => {
    const result = await db.run('UPDATE users SET is_suspended = 0 WHERE id = ?', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    await audit(req, 'unsuspend_user', 'user', Number(req.params.id));
    res.json({ ok: true, suspended: false });
  });

  // ── Admin: manage reports ──

  router.get('/admin/reports', adminRequired, async (_req, res) => {
    const reports = await db.all(`
      SELECT reports.*, users.username AS reporter_username,
        (SELECT username FROM users WHERE users.id = reports.target_id AND reports.target_type = 'user') AS target_username
      FROM reports LEFT JOIN users ON users.id = reports.reporter_id
      ORDER BY reports.created_at DESC
      LIMIT 100
    `);
    res.json({ reports });
  });

  router.post('/admin/reports/:id/resolve', adminRequired, async (req, res) => {
    const result = await db.run("UPDATE reports SET status = 'resolved' WHERE id = ?", req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Report not found' });
    await audit(req, 'resolve_report', 'report', Number(req.params.id));
    res.json({ ok: true, status: 'resolved' });
  });

  router.post('/admin/reports/:id/dismiss', adminRequired, async (req, res) => {
    const result = await db.run("UPDATE reports SET status = 'dismissed' WHERE id = ?", req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Report not found' });
    await audit(req, 'dismiss_report', 'report', Number(req.params.id));
    res.json({ ok: true, status: 'dismissed' });
  });

  // ── Admin: hide / unhide post ──

  router.delete('/admin/posts/:id', adminRequired, async (req, res) => {
    const post = await db.get('SELECT id FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await db.run('UPDATE posts SET is_hidden = 1 WHERE id = ?', post.id);
    await db.run("UPDATE reports SET status = 'resolved' WHERE target_type = 'post' AND target_id = ?", post.id);
    await audit(req, 'hide_post', 'post', post.id);
    res.json({ ok: true, hidden: true });
  });

  router.post('/admin/posts/:id/unhide', adminRequired, async (req, res) => {
    const post = await db.get('SELECT id FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await db.run('UPDATE posts SET is_hidden = 0 WHERE id = ?', post.id);
    await audit(req, 'unhide_post', 'post', post.id);
    res.json({ ok: true, hidden: false });
  });

  // ── Admin: bulk actions ──

  router.post('/admin/bulk', adminRequired, async (req, res) => {
    const { action, ids, extra } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > 100) return res.status(400).json({ error: 'Max 100 items per bulk action' });
    let done = 0;

    for (const id of ids) {
        if (action === 'hide_posts') {
          await db.run('UPDATE posts SET is_hidden = 1 WHERE id = ?', id);
          await audit(req, 'bulk_hide_posts', 'post', id);
          done++;
        } else if (action === 'unhide_posts') {
          await db.run('UPDATE posts SET is_hidden = 0 WHERE id = ?', id);
          await audit(req, 'bulk_unhide_posts', 'post', id);
          done++;
        } else if (action === 'suspend_users') {
          if (Number(id) !== req.user.id) {
            await db.run('UPDATE users SET is_suspended = 1 WHERE id = ?', id);
            await audit(req, 'bulk_suspend_users', 'user', id);
            done++;
          }
        } else if (action === 'unsuspend_users') {
          await db.run('UPDATE users SET is_suspended = 0 WHERE id = ?', id);
          await audit(req, 'bulk_unsuspend_users', 'user', id);
          done++;
        } else if (action === 'resolve_reports') {
          await db.run("UPDATE reports SET status = 'resolved' WHERE id = ?", id);
          await audit(req, 'bulk_resolve_reports', 'report', id);
          done++;
        } else if (action === 'delete_users') {
          if (Number(id) !== req.user.id) {
            await audit(req, 'bulk_delete_users', 'user', id);
            await db.run('DELETE FROM users WHERE id = ?', id);
            done++;
          }
        } else if (action === 'delete_posts') {
          const post = await db.get('SELECT id FROM posts WHERE id = ?', id);
          if (post) {
            await db.run('DELETE FROM posts WHERE id = ?', id);
            await audit(req, 'bulk_delete_posts', 'post', id);
            done++;
          }
        }
      }
    res.json({ ok: true, action, processed: done, total: ids.length });
  });

  // ── Admin: seed random users ──

  const adjectives = ['Swift', 'Brave', 'Clever', 'Quiet', 'Fierce', 'Gentle', 'Happy', 'Lucky', 'Bold', 'Calm', 'Eager', 'Noble', 'Proud', 'Sharp', 'Wise', 'Bright', 'Daring', 'Fancy', 'Grand', 'Kind', 'Neat', 'Prime', 'Rich', 'Safe', 'Cool', 'Epic', 'Fair', 'Gold', 'High', 'Fast'];
  const nouns = ['Panda', 'Falcon', 'Tiger', 'Dolphin', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Lynx', 'Hawk', 'Otter', 'Raven', 'Elk', 'Owl', 'Hare', 'Koala', 'Lion', 'Deer', 'Seal', 'Viper', 'Ape', 'Bat', 'Mole', 'Gnat', 'Jay', 'Ram', 'Yak', 'Zebra', 'Crab', 'Moth'];

  function randomUsername() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 999);
    return `${adj}${noun}${num}`;
  }

  router.post('/admin/seed/users', adminRequired, async (req, res) => {
    const count = Math.min(Math.max(Number(req.body.count) || 1, 1), 100);
    // Pre-compute passwords outside the transaction (better-sqlite3 tx is sync)
    const seeds: any[] = [];
    for (let i = 0; i < count; i++) {
      let username, email, password;
      let attempts = 0;
      do {
        username = randomUsername();
        email = `${username.toLowerCase()}@seed.test`;
        attempts++;
      } while (attempts < 20 && await db.get('SELECT 1 FROM users WHERE username = ? OR email = ?', username, email));
      if (attempts >= 20) continue;
      password = crypto.randomBytes(4).toString('hex') + 'Aa1!';
      seeds.push({ username, email, passwordHash: bcrypt.hashSync(password, 10), password });
    }

    const created: any[] = [];
    for (const s of seeds) {
      const result = await db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', s.username, s.email, s.passwordHash);
      await db.run('INSERT INTO member_profiles (user_id) VALUES (?)', result.lastInsertRowid);
      created.push({ username: s.username, email: s.email, password: s.password });
    }
    await audit(req, 'seed_users', 'user', 0, `Seeded ${created.length} users`);
    res.status(201).json({ created: created.length, users: created });
  });

  // ── Admin: create a specific user ──

  router.post('/admin/users', adminRequired, async (req, res) => {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || 'Password123!');
    if (!username || !email) return res.status(400).json({ error: 'Username and email are required' });
    if (username.length < 3 || username.length > 24) return res.status(400).json({ error: 'Username must be 3-24 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' });

    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', username, email, passwordHash);
    const user = await db.get('SELECT * FROM users WHERE id = ?', result.lastInsertRowid);
    await db.run('INSERT INTO member_profiles (user_id) VALUES (?)', user.id);
    await audit(req, 'create_user', 'user', user.id, `Created by admin`);
    res.status(201).json({ user: adminUser(user) });
  });

  // ── Admin: delete a user ──

  router.delete('/admin/users/:id', adminRequired, async (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
    const result = await db.run('DELETE FROM users WHERE id = ?', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    await audit(req, 'delete_user', 'user', Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: user detail page data ──

  router.get('/admin/users/:id/detail', adminRequired, async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = await db.all(`
      SELECT posts.*,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
      FROM posts WHERE posts.user_id = ? ORDER BY posts.created_at DESC LIMIT 50
    `, user.id);

    const reportsAgainst = await db.all(`
      SELECT reports.*, users.username AS reporter_username FROM reports
      LEFT JOIN users ON users.id = reports.reporter_id
      WHERE reports.target_type = 'post' AND reports.target_id IN (SELECT id FROM posts WHERE user_id = ?)
      ORDER BY reports.created_at DESC LIMIT 20
    `, user.id);

    const blocks = await db.all(`
      SELECT blocks.*, users.username AS blocked_username FROM blocks
      JOIN users ON users.id = blocks.blocked_id
      WHERE blocks.blocker_id = ?
    `, user.id);

    const blockedBy = await db.all(`
      SELECT blocks.*, users.username AS blocker_username FROM blocks
      JOIN users ON users.id = blocks.blocker_id
      WHERE blocks.blocked_id = ?
    `, user.id);

    res.json({
      user: { ...adminUser(user), post_count: posts.length },
      posts, reportsAgainst, blocks, blockedBy
    });
  });

  return router;
}
