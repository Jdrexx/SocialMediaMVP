// @ts-nocheck
import express from 'express';
import { ownUser, publicUser } from '../../lib/auth';
import { authRequired } from '../../lib/http';
import { createNotification } from '../../lib/notifications';
import { getPosts } from '../../lib/posts';
import { profileSchema } from '../../lib/schemas';

export function createUsersRouter({ db }) {
  const router = express.Router();

  router.get('/me', authRequired, (req, res) => res.json({ user: ownUser(req.user) }));

  router.patch('/me', authRequired, async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const bio = parsed.data.bio ?? req.user.bio;
    const avatarUrl = parsed.data.avatar_url ?? req.user.avatar_url;
    const coverUrl = parsed.data.cover_url ?? req.user.cover_url;
    await db.run('UPDATE users SET bio = ?, avatar_url = ?, cover_url = ? WHERE id = ?', bio, avatarUrl, coverUrl, req.user.id);

    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: ownUser(user) });
  });

  router.post('/me/avatar', authRequired, async (req, res) => {
    const mediaId = Number(req.body.media_id);
    const media = await db.get('SELECT * FROM media WHERE id = ? AND user_id = ? AND mime_type LIKE ?', mediaId, req.user.id, 'image/%');
    if (!media) return res.status(400).json({ error: 'Upload an image first and pass its media_id' });
    await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', media.url, req.user.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: ownUser(user) });
  });

  router.post('/me/cover', authRequired, async (req, res) => {
    const mediaId = Number(req.body.media_id);
    const media = await db.get('SELECT * FROM media WHERE id = ? AND user_id = ? AND mime_type LIKE ?', mediaId, req.user.id, 'image/%');
    if (!media) return res.status(400).json({ error: 'Upload an image first and pass its media_id' });
    await db.run('UPDATE users SET cover_url = ? WHERE id = ?', media.url, req.user.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: ownUser(user) });
  });

  router.get('/users/:username', async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE username = ?', req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const follower_count = await db.get('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?', user.id).c;
    const following_count = await db.get('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?', user.id).c;
    const following = req.user ? Boolean(await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, user.id)) : false;

    res.json({
      user: { ...publicUser(user), follower_count, following_count, following },
      posts: await getPosts(db, req.user?.id, 'WHERE posts.user_id = ?', [user.id])
    });
  });

  router.post('/users/:username/follow', authRequired, async (req, res) => {
    const target = await db.get('SELECT id FROM users WHERE username = ?', req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });

    const existing = await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, target.id);
    if (existing) {
      await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, target.id);
      return res.json({ following: false });
    }

    db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', req.user.id, target.id);
    createNotification(db, { userId: target.id, actorId: req.user.id, type: 'follow', entityType: 'user', entityId: req.user.id, body: `${req.user.username} followed you` });
    res.json({ following: true });
  });

  return router;
}
