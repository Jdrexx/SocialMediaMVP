import express from 'express';
import { publicUser } from '../../lib/auth.js';
import { authRequired } from '../../lib/http.js';
import { createNotification } from '../../lib/notifications.js';
import { getPosts } from '../../lib/posts.js';
import { profileSchema } from '../../lib/schemas.js';

export function createUsersRouter({ db }) {
  const router = express.Router();

  router.get('/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

  router.patch('/me', authRequired, (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const bio = parsed.data.bio ?? req.user.bio;
    const avatarUrl = parsed.data.avatar_url ?? req.user.avatar_url;
    db.prepare('UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?').run(bio, avatarUrl, req.user.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(user) });
  });

  router.get('/users/:username', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const follower_count = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?').get(user.id).c;
    const following_count = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?').get(user.id).c;
    const following = req.user ? Boolean(db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id)) : false;

    res.json({
      user: { ...publicUser(user), follower_count, following_count, following },
      posts: getPosts(db, req.user?.id, 'WHERE posts.user_id = ?', [user.id])
    });
  });

  router.post('/users/:username/follow', authRequired, (req, res) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });

    const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target.id);
    if (existing) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
      return res.json({ following: false });
    }

    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    createNotification(db, { userId: target.id, actorId: req.user.id, type: 'follow', entityType: 'user', entityId: req.user.id, body: `${req.user.username} followed you` });
    res.json({ following: true });
  });

  return router;
}
