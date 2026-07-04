import express from 'express';
import bcrypt from 'bcryptjs';
import { adminRequired, authRequired } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';
import { reportSchema } from '../../lib/schemas.js';
import { logAdminAction } from '../../lib/audit.js';

export function createModerationRouter({ db }) {
  const router = express.Router();

  function audit(req, action, targetType, targetId, details = '') {
    logAdminAction(db, { adminId: req.user.id, action, targetType, targetId, details });
  }

  // ── Reports (user-facing) ──

  router.post('/reports/posts/:id', authRequired, (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const result = db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)').run(req.user.id, 'post', post.id, parsed.data.reason);
    res.status(201).json({ report: db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid) });
  });

  // ── Admin: dashboard stats ──

  router.get('/admin/stats', adminRequired, (_req, res) => {
    const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const admins = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get().c;
    const suspended = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_suspended = 1').get().c;
    const blocked = db.prepare('SELECT COUNT(*) AS c FROM blocks').get().c;
    const posts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
    const hiddenPosts = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE is_hidden = 1').get().c;
    const reportsOpen = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'").get().c;
    const reportsResolved = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'resolved'").get().c;
    const reportsDismissed = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'dismissed'").get().c;
    const commentsTotal = db.prepare('SELECT COUNT(*) AS c FROM comments').get().c;
    const messagesTotal = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c;
    const followsTotal = db.prepare('SELECT COUNT(*) AS c FROM follows').get().c;
    const uploadsTotal = db.prepare('SELECT COUNT(*) AS c FROM media').get().c;
    const bookmarksTotal = db.prepare('SELECT COUNT(*) AS c FROM bookmarks').get().c;
    const auditLogTotal = db.prepare('SELECT COUNT(*) AS c FROM activity_log').get().c;

    res.json({
      users, admins, suspended, blocked,
      posts, hiddenPosts,
      reportsOpen, reportsResolved, reportsDismissed,
      commentsTotal, messagesTotal, followsTotal, uploadsTotal,
      bookmarksTotal, auditLogTotal
    });
  });

  // ── Admin: activity log ──

  router.get('/admin/log', adminRequired, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const entries = db.prepare(`
      SELECT activity_log.*, users.username AS admin_username
      FROM activity_log
      LEFT JOIN users ON users.id = activity_log.admin_id
      ORDER BY activity_log.created_at DESC
      LIMIT ?
    `).all(limit);
    res.json({ entries });
  });

  // ── Admin: list all posts ──

  router.get('/admin/posts', adminRequired, (req, res) => {
    const hideFilter = req.query.hidden;
    const search = String(req.query.q || '').trim();
    let where = '1=1';
    const params = [];

    if (hideFilter === '1') { where += ' AND posts.is_hidden = 1'; }
    else if (hideFilter === '0') { where += ' AND posts.is_hidden = 0'; }

    if (search) {
      where += ' AND (posts.body LIKE ? OR users.username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const posts = db.prepare(`
      SELECT posts.*, users.username, users.avatar_url, media.url AS media_url, media.mime_type AS media_type,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
      FROM posts
      JOIN users ON users.id = posts.user_id
      LEFT JOIN media ON media.id = posts.media_id
      WHERE ${where}
      ORDER BY posts.created_at DESC, posts.id DESC
      LIMIT 100
    `).all(...params);

    res.json({ posts });
  });

  // ── Admin: edit post content (PATCH) ──

  router.patch('/admin/posts/:id', adminRequired, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const body = String(req.body.body ?? post.body).trim();
    if (!body) return res.status(400).json({ error: 'Post body cannot be empty' });
    db.prepare('UPDATE posts SET body = ?, edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body, post.id);
    audit(req, 'edit_post', 'post', post.id, `Body edited by admin`);
    res.json({ ok: true });
  });

  // ── Admin: list all users ──

  router.get('/admin/users', adminRequired, (_req, res) => {
    const users = db.prepare(`
      SELECT id, username, email, bio, avatar_url, cover_url,
        email_verified, is_admin, is_suspended, created_at,
        (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS post_count,
        (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id) AS follower_count,
        (SELECT COUNT(*) FROM blocks WHERE blocks.blocked_id = users.id) AS blocked_by_count
      FROM users ORDER BY created_at DESC
    `).all();
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

  router.patch('/admin/users/:id', adminRequired, (req, res) => {
    if (Number(req.params.id) === req.user.id && req.body.is_admin === false) {
      return res.status(400).json({ error: 'You cannot remove your own admin status' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const username = req.body.username ?? user.username;
    const email = req.body.email ?? user.email;
    const bio = req.body.bio ?? user.bio;
    const isAdmin = req.body.is_admin !== undefined ? (req.body.is_admin ? 1 : 0) : user.is_admin;
    const isSuspended = req.body.is_suspended !== undefined ? (req.body.is_suspended ? 1 : 0) : user.is_suspended;

    db.prepare('UPDATE users SET username = ?, email = ?, bio = ?, is_admin = ?, is_suspended = ? WHERE id = ?')
      .run(username, email, bio, isAdmin, isSuspended, user.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const changed = [];
    if (username !== user.username) changed.push('username');
    if (email !== user.email) changed.push('email');
    if (Number(isAdmin) !== user.is_admin) changed.push(`is_admin:${isAdmin ? 'promote' : 'demote'}`);
    if (Number(isSuspended) !== user.is_suspended) changed.push(`suspend:${isSuspended}`);
    audit(req, 'edit_user', 'user', user.id, changed.join(', '));

    res.json({ user: publicUser(updated) });
  });

  // ── Admin: suspend / unsuspend user ──

  router.post('/admin/users/:id/suspend', adminRequired, (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend yourself' });
    const result = db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    audit(req, 'suspend_user', 'user', Number(req.params.id));
    res.json({ ok: true, suspended: true });
  });

  router.post('/admin/users/:id/unsuspend', adminRequired, (req, res) => {
    const result = db.prepare('UPDATE users SET is_suspended = 0 WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    audit(req, 'unsuspend_user', 'user', Number(req.params.id));
    res.json({ ok: true, suspended: false });
  });

  // ── Admin: manage reports ──

  router.get('/admin/reports', adminRequired, (_req, res) => {
    const reports = db.prepare(`
      SELECT reports.*, users.username AS reporter_username,
        (SELECT username FROM users WHERE users.id = reports.target_id AND reports.target_type = 'user') AS target_username
      FROM reports LEFT JOIN users ON users.id = reports.reporter_id
      ORDER BY reports.created_at DESC
      LIMIT 100
    `).all();
    res.json({ reports });
  });

  router.post('/admin/reports/:id/resolve', adminRequired, (req, res) => {
    const result = db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Report not found' });
    audit(req, 'resolve_report', 'report', Number(req.params.id));
    res.json({ ok: true, status: 'resolved' });
  });

  router.post('/admin/reports/:id/dismiss', adminRequired, (req, res) => {
    const result = db.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Report not found' });
    audit(req, 'dismiss_report', 'report', Number(req.params.id));
    res.json({ ok: true, status: 'dismissed' });
  });

  // ── Admin: hide / unhide post ──

  router.delete('/admin/posts/:id', adminRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    db.prepare('UPDATE posts SET is_hidden = 1 WHERE id = ?').run(post.id);
    db.prepare("UPDATE reports SET status = 'resolved' WHERE target_type = 'post' AND target_id = ?").run(post.id);
    audit(req, 'hide_post', 'post', post.id);
    res.json({ ok: true, hidden: true });
  });

  router.post('/admin/posts/:id/unhide', adminRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    db.prepare('UPDATE posts SET is_hidden = 0 WHERE id = ?').run(post.id);
    audit(req, 'unhide_post', 'post', post.id);
    res.json({ ok: true, hidden: false });
  });

  // ── Admin: bulk actions ──

  router.post('/admin/bulk', adminRequired, (req, res) => {
    const { action, ids, extra } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > 100) return res.status(400).json({ error: 'Max 100 items per bulk action' });
    let done = 0;
    const tx = db.transaction(() => {
      for (const id of ids) {
        if (action === 'hide_posts') {
          db.prepare('UPDATE posts SET is_hidden = 1 WHERE id = ?').run(id);
          audit(req, 'bulk_hide_posts', 'post', id);
          done++;
        } else if (action === 'unhide_posts') {
          db.prepare('UPDATE posts SET is_hidden = 0 WHERE id = ?').run(id);
          audit(req, 'bulk_unhide_posts', 'post', id);
          done++;
        } else if (action === 'suspend_users') {
          if (Number(id) !== req.user.id) {
            db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(id);
            audit(req, 'bulk_suspend_users', 'user', id);
            done++;
          }
        } else if (action === 'unsuspend_users') {
          db.prepare('UPDATE users SET is_suspended = 0 WHERE id = ?').run(id);
          audit(req, 'bulk_unsuspend_users', 'user', id);
          done++;
        } else if (action === 'resolve_reports') {
          db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ?").run(id);
          audit(req, 'bulk_resolve_reports', 'report', id);
          done++;
        } else if (action === 'delete_users') {
          if (Number(id) !== req.user.id) {
            db.prepare('DELETE FROM users WHERE id = ?').run(id);
            audit(req, 'bulk_delete_users', 'user', id);
            done++;
          }
        } else if (action === 'delete_posts') {
          const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
          if (post) {
            db.prepare('DELETE FROM posts WHERE id = ?').run(id);
            audit(req, 'bulk_delete_posts', 'post', id);
            done++;
          }
        }
      }
    });
    tx();
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
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const insert = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const created = [];

    const tx = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        let username, email;
        let attempts = 0;
        do {
          username = randomUsername();
          email = `${username.toLowerCase()}@seed.test`;
          attempts++;
        } while (attempts < 20 && db.prepare('SELECT 1 FROM users WHERE username = ? OR email = ?').get(username, email));
        if (attempts >= 20) continue;
        insert.run(username, email, passwordHash);
        created.push({ username, email });
      }
    });
    tx();
    audit(req, 'seed_users', 'user', 0, `Seeded ${created.length} users`);
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

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    audit(req, 'create_user', 'user', user.id, `Created by admin`);
    res.status(201).json({ user: publicUser(user) });
  });

  // ── Admin: delete a user ──

  router.delete('/admin/users/:id', adminRequired, (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    audit(req, 'delete_user', 'user', Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: user detail page data ──

  router.get('/admin/users/:id/detail', adminRequired, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = db.prepare(`
      SELECT posts.*,
        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count
      FROM posts WHERE posts.user_id = ? ORDER BY posts.created_at DESC LIMIT 50
    `).all(user.id);

    const reportsAgainst = db.prepare(`
      SELECT reports.*, users.username AS reporter_username FROM reports
      LEFT JOIN users ON users.id = reports.reporter_id
      WHERE reports.target_type = 'post' AND reports.target_id IN (SELECT id FROM posts WHERE user_id = ?)
      ORDER BY reports.created_at DESC LIMIT 20
    `).all(user.id);

    const blocks = db.prepare(`
      SELECT blocks.*, users.username AS blocked_username FROM blocks
      JOIN users ON users.id = blocks.blocked_id
      WHERE blocks.blocker_id = ?
    `).all(user.id);

    const blockedBy = db.prepare(`
      SELECT blocks.*, users.username AS blocker_username FROM blocks
      JOIN users ON users.id = blocks.blocker_id
      WHERE blocks.blocked_id = ?
    `).all(user.id);

    res.json({
      user: { ...publicUser(user), post_count: posts.length },
      posts, reportsAgainst, blocks, blockedBy
    });
  });

  return router;
}
