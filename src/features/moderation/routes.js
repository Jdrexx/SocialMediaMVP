import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { adminRequired, authRequired } from '../../lib/http.js';
import { publicUser } from '../../lib/auth.js';
import { reportSchema } from '../../lib/schemas.js';

export function createModerationRouter({ db }) {
  const router = express.Router();

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
    const posts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
    const hiddenPosts = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE is_hidden = 1').get().c;
    const reportsOpen = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'").get().c;
    const reportsResolved = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'resolved'").get().c;
    const reportsDismissed = db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'dismissed'").get().c;
    const commentsTotal = db.prepare('SELECT COUNT(*) AS c FROM comments').get().c;
    const messagesTotal = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c;
    const followsTotal = db.prepare('SELECT COUNT(*) AS c FROM follows').get().c;
    const uploadsTotal = db.prepare('SELECT COUNT(*) AS c FROM media').get().c;

    res.json({
      users, admins, suspended,
      posts, hiddenPosts,
      reportsOpen, reportsResolved, reportsDismissed,
      commentsTotal, messagesTotal, followsTotal, uploadsTotal
    });
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

  // ── Admin: list all users ──

  router.get('/admin/users', adminRequired, (_req, res) => {
    const users = db.prepare(`
      SELECT id, username, email, bio, avatar_url, cover_url,
        email_verified, is_admin, is_suspended, created_at,
        (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) AS post_count,
        (SELECT COUNT(*) FROM follows WHERE follows.following_id = users.id) AS follower_count
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
    res.json({ user: publicUser(updated) });
  });

  // ── Admin: suspend / unsuspend user ──

  router.post('/admin/users/:id/suspend', adminRequired, (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend yourself' });
    const result = db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, suspended: true });
  });

  router.post('/admin/users/:id/unsuspend', adminRequired, (req, res) => {
    const result = db.prepare('UPDATE users SET is_suspended = 0 WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
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
    res.json({ ok: true, status: 'resolved' });
  });

  router.post('/admin/reports/:id/dismiss', adminRequired, (req, res) => {
    const result = db.prepare("UPDATE reports SET status = 'dismissed' WHERE id = ?").run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Report not found' });
    res.json({ ok: true, status: 'dismissed' });
  });

  // ── Admin: hide / unhide post ──

  router.delete('/admin/posts/:id', adminRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    db.prepare('UPDATE posts SET is_hidden = 1 WHERE id = ?').run(post.id);
    db.prepare("UPDATE reports SET status = 'resolved' WHERE target_type = 'post' AND target_id = ?").run(post.id);
    res.json({ ok: true, hidden: true });
  });

  router.post('/admin/posts/:id/unhide', adminRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    db.prepare('UPDATE posts SET is_hidden = 0 WHERE id = ?').run(post.id);
    res.json({ ok: true, hidden: false });
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

    res.status(201).json({ created: created.length, users: created });
  });

  return router;
}
