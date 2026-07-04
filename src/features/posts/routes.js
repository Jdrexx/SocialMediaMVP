import express from 'express';
import { authRequired } from '../../lib/http.js';
import { createNotification } from '../../lib/notifications.js';
import { getPosts } from '../../lib/posts.js';
import { commentSchema, postSchema } from '../../lib/schemas.js';

export function createPostsRouter({ db }) {
  const router = express.Router();

  // ── Feed (authenticated, follows-based) ──

  router.get('/feed', authRequired, (req, res) => {
    const before = req.query.before;
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const params = [req.user.id, req.user.id];
    const whereBase = 'WHERE (posts.user_id = ? OR posts.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))';

    if (before) {
      const parts = before.split('_');
      const beforeId = Number(parts[0]);
      const beforeDate = parts.slice(1).join('_');
      if (beforeId && beforeDate) {
        const cursorParams = [beforeDate, beforeDate, beforeId, ...params];
        const posts = getPosts(db, req.user.id,
          `${whereBase} AND (posts.created_at < ? OR (posts.created_at = ? AND posts.id < ?))`,
          cursorParams, limit + 1
        );
        const hasMore = posts.length > limit;
        if (hasMore) posts.pop();
        const next = hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null;
        return res.json({ posts, next });
      }
    }
    const posts = getPosts(db, req.user.id, whereBase, params, limit + 1);
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    const next = hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null;
    res.json({ posts, next });
  });

  // ── Public feed ──

  router.get('/posts', (req, res) => {
    const before = req.query.before;
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const params = [];

    if (before) {
      const parts = before.split('_');
      const beforeId = Number(parts[0]);
      const beforeDate = parts.slice(1).join('_').replace('T', ' ');
      if (beforeId && beforeDate) {
        params.push(beforeDate, beforeDate, beforeId);
        const posts = getPosts(db, req.user?.id,
          'WHERE (posts.created_at < ? OR (posts.created_at = ? AND posts.id < ?))',
          params, limit + 1
        );
        const hasMore = posts.length > limit;
        if (hasMore) posts.pop();
        return res.json({ posts, next: hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null });
      }
    }
    const posts = getPosts(db, req.user?.id, '', [], limit + 1);
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    res.json({ posts, next: hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null });
  });

  // ── Create post ──

  router.post('/posts', authRequired, (req, res) => {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    let mediaId = parsed.data.media_id || null;
    if (mediaId) {
      const media = db.prepare('SELECT id FROM media WHERE id = ? AND user_id = ?').get(mediaId, req.user.id);
      if (!media) return res.status(400).json({ error: 'Media not found' });
    }

    const result = db.prepare('INSERT INTO posts (user_id, body, image_url, media_id) VALUES (?, ?, ?, ?)').run(req.user.id, parsed.data.body, parsed.data.image_url || '', mediaId);
    const post = getPosts(db, req.user.id, 'WHERE posts.id = ?', [result.lastInsertRowid], 1)[0];
    res.status(201).json({ post });
  });

  // ── Edit post ──

  router.patch('/posts/:id', authRequired, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts' });
    const body = String(req.body.body || '').trim();
    if (!body || body.length > 500) return res.status(400).json({ error: 'Post body must be 1-500 characters' });
    db.prepare('UPDATE posts SET body = ?, edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body, post.id);
    const updated = getPosts(db, req.user.id, 'WHERE posts.id = ?', [post.id], 1)[0];
    res.json({ post: updated });
  });

  // ── Delete post ──

  router.delete('/posts/:id', authRequired, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ── Like / unlike ──

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

  // ── Comment ──

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

  // ── Bookmarks ──

  router.post('/bookmarks/:postId', authRequired, (req, res) => {
    const postId = Number(req.params.postId);
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const existing = db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.user.id, post.id);
      return res.json({ bookmarked: false });
    }
    db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.user.id, post.id);
    res.json({ bookmarked: true });
  });

  router.get('/bookmarks', authRequired, (req, res) => {
    const postIds = db.prepare('SELECT post_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map((r) => r.post_id);
    if (postIds.length === 0) return res.json({ posts: [] });
    const placeholder = postIds.map(() => '?').join(',');
    const posts = getPosts(db, req.user.id, `WHERE posts.id IN (${placeholder})`, postIds, 100);
    const map = {};
    posts.forEach((p) => { map[p.id] = p; });
    res.json({ posts: postIds.map((id) => map[id]).filter(Boolean) });
  });

  // ── Block / unblock user ──

  router.post('/blocks/:userId', authRequired, (req, res) => {
    const userId = Number(req.params.userId);
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot block yourself' });
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const existing = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(req.user.id, target.id);
    if (existing) {
      db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, target.id);
      return res.json({ blocked: false });
    }
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(req.user.id, target.id);
    res.json({ blocked: true });
  });

  router.get('/blocks', authRequired, (req, res) => {
    const blocked = db.prepare(`
      SELECT users.id, users.username, users.avatar_url, blocks.created_at
      FROM blocks JOIN users ON users.id = blocks.blocked_id
      WHERE blocks.blocker_id = ? ORDER BY blocks.created_at DESC
    `).all(req.user.id);
    res.json({ blocked });
  });

  return router;
}
