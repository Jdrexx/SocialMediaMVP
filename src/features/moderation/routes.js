import express from 'express';
import { adminRequired, authRequired } from '../../lib/http.js';
import { reportSchema } from '../../lib/schemas.js';

export function createModerationRouter({ db }) {
  const router = express.Router();

  router.post('/reports/posts/:id', authRequired, (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const result = db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)').run(req.user.id, 'post', post.id, parsed.data.reason);
    res.status(201).json({ report: db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid) });
  });

  router.get('/admin/reports', adminRequired, (_req, res) => {
    const reports = db.prepare(`
      SELECT reports.*, users.username AS reporter_username
      FROM reports LEFT JOIN users ON users.id = reports.reporter_id
      ORDER BY reports.created_at DESC
      LIMIT 100
    `).all();
    res.json({ reports });
  });

  router.get('/admin/users', adminRequired, (_req, res) => {
    const users = db.prepare('SELECT id, username, email, email_verified, is_admin, is_suspended, created_at FROM users ORDER BY created_at DESC').all();
    res.json({ users: users.map((u) => ({ ...u, email_verified: Boolean(u.email_verified), is_admin: Boolean(u.is_admin), is_suspended: Boolean(u.is_suspended) })) });
  });

  router.delete('/admin/posts/:id', adminRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    db.prepare('UPDATE posts SET is_hidden = 1 WHERE id = ?').run(post.id);
    db.prepare("UPDATE reports SET status = 'resolved' WHERE target_type = 'post' AND target_id = ?").run(post.id);
    res.json({ ok: true });
  });

  router.post('/admin/users/:id/suspend', adminRequired, (req, res) => {
    if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot suspend yourself' });
    const result = db.prepare('UPDATE users SET is_suspended = 1 WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  });

  return router;
}
