import express from 'express';
import { authRequired } from '../../lib/http.js';
import { createNotification } from '../../lib/notifications.js';
import { getPosts } from '../../lib/posts.js';
import { commentSchema, postSchema } from '../../lib/schemas.js';

export function createPostsRouter({ db }) {
  const router = express.Router();

  router.get('/feed', authRequired, (req, res) => {
    const posts = getPosts(
      db,
      req.user.id,
      'WHERE (posts.user_id = ? OR posts.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))',
      [req.user.id, req.user.id]
    );
    res.json({ posts });
  });

  router.get('/posts', (req, res) => res.json({ posts: getPosts(db, req.user?.id) }));

  router.post('/posts', authRequired, (req, res) => {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    let mediaId = parsed.data.media_id || null;
    if (mediaId) {
      const media = db.prepare('SELECT id FROM media WHERE id = ? AND user_id = ?').get(mediaId, req.user.id);
      if (!media) return res.status(400).json({ error: 'Media not found' });
    }

    const result = db.prepare('INSERT INTO posts (user_id, body, image_url, media_id) VALUES (?, ?, ?, ?)').run(req.user.id, parsed.data.body, parsed.data.image_url || '', mediaId);
    const post = getPosts(db, req.user.id, 'WHERE posts.id = ?', [result.lastInsertRowid])[0];
    res.status(201).json({ post });
  });

  router.delete('/posts/:id', authRequired, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });

    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  router.post('/posts/:id/like', authRequired, (req, res) => {
    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, post.id);
      return res.json({ liked: false });
    }

    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, post.id);
    createNotification(db, { userId: post.user_id, actorId: req.user.id, type: 'like', entityType: 'post', entityId: post.id, body: `${req.user.username} liked your post` });
    res.json({ liked: true });
  });

  router.post('/posts/:id/comments', authRequired, (req, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const post = db.prepare('SELECT id, user_id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const result = db.prepare('INSERT INTO comments (user_id, post_id, body) VALUES (?, ?, ?)').run(req.user.id, post.id, parsed.data.body);
    const comment = db.prepare(`
      SELECT comments.*, users.username, users.avatar_url
      FROM comments JOIN users ON users.id = comments.user_id
      WHERE comments.id = ?
    `).get(result.lastInsertRowid);

    createNotification(db, { userId: post.user_id, actorId: req.user.id, type: 'comment', entityType: 'post', entityId: post.id, body: `${req.user.username} commented: ${parsed.data.body}` });
    res.status(201).json({ comment });
  });

  return router;
}
