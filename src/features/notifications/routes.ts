// @ts-nocheck
import express from 'express';
import { authRequired } from '../../lib/http';

export function createNotificationsRouter({ db }) {
  const router = express.Router();

  router.get('/notifications', authRequired, async (req, res) => {
    const notifications = await db.all(`
      SELECT notifications.*, users.username AS actor_username, users.avatar_url AS actor_avatar_url
      FROM notifications
      LEFT JOIN users ON users.id = notifications.actor_id
      WHERE notifications.user_id = ?
      ORDER BY notifications.created_at DESC, notifications.id DESC
      LIMIT 50
    `, req.user.id);
    res.json({ notifications: notifications.map((n) => ({ ...n, read: Boolean(n.read_at) })) });
  });

  router.post('/notifications/:id/read', authRequired, async (req, res) => {
    const result = db.run('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  });

  router.post('/notifications/read-all', authRequired, async (req, res) => {
    db.run('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id = ?', req.user.id);
    res.json({ ok: true });
  });

  return router;
}
