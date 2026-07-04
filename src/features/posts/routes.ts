// @ts-nocheck
import express from 'express';
import { authRequired } from '../../lib/http';
import { createNotification } from '../../lib/notifications';
import { getPosts } from '../../lib/posts';
import { commentSchema, postSchema } from '../../lib/schemas';

export function createPostsRouter({ db }) {
  const router = express.Router();

  // ── Feed (authenticated, follows-based) ──

  router.get('/feed', authRequired, async (req, res) => {
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
        const posts = await getPosts(db, req.user.id,
          `${whereBase} AND (posts.created_at < ? OR (posts.created_at = ? AND posts.id < ?))`,
          cursorParams, limit + 1
        );
        const hasMore = posts.length > limit;
        if (hasMore) posts.pop();
        const next = hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null;
        return res.json({ posts, next });
      }
    }
    const posts = await getPosts(db, req.user.id, whereBase, params, limit + 1);
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    const next = hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null;
    res.json({ posts, next });
  });

  // ── Public feed ──

  router.get('/posts', async (req, res) => {
    const before = req.query.before;
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const params: any[] = [];

    if (before) {
      const parts = before.split('_');
      const beforeId = Number(parts[0]);
      const beforeDate = parts.slice(1).join('_').replace('T', ' ');
      if (beforeId && beforeDate) {
        params.push(beforeDate, beforeDate, beforeId);
        const posts = await getPosts(db, req.user?.id,
          'WHERE (posts.created_at < ? OR (posts.created_at = ? AND posts.id < ?))',
          params, limit + 1
        );
        const hasMore = posts.length > limit;
        if (hasMore) posts.pop();
        return res.json({ posts, next: hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null });
      }
    }
    const posts = await getPosts(db, req.user?.id, '', [], limit + 1);
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    res.json({ posts, next: hasMore ? `${posts[posts.length - 1].id}_${posts[posts.length - 1].created_at.replace(' ', 'T')}` : null });
  });

  // ── Create post ──

  router.post('/posts', authRequired, async (req, res) => {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    let mediaId = parsed.data.media_id || null;
    if (mediaId) {
      const media = await db.get('SELECT id FROM media WHERE id = ? AND user_id = ?', mediaId, req.user.id);
      if (!media) return res.status(400).json({ error: 'Media not found' });
    }

    const result = db.run('INSERT INTO posts (user_id, body, image_url, media_id) VALUES (?, ?, ?, ?)', req.user.id, parsed.data.body, parsed.data.image_url || '', mediaId);
    const post = (await getPosts(db, req.user.id, 'WHERE posts.id = ?', [result.lastInsertRowid], 1))[0];
    res.status(201).json({ post });
  });

  // ── Edit post ──

  router.patch('/posts/:id', authRequired, async (req, res) => {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts' });
    const body = String(req.body.body || '').trim();
    if (!body || body.length > 500) return res.status(400).json({ error: 'Post body must be 1-500 characters' });
    await db.run('UPDATE posts SET body = ?, edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', body, post.id);
    const updated = (await getPosts(db, req.user.id, 'WHERE posts.id = ?', [post.id], 1))[0];
    res.json({ post: updated });
  });

  // ── Delete post ──

  router.delete('/posts/:id', authRequired, async (req, res) => {
    const post = await db.get('SELECT * FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
    await db.run('DELETE FROM posts WHERE id = ?', req.params.id);
    res.json({ ok: true });
  });

  // ── Like / unlike ──

  router.post('/posts/:id/like', authRequired, async (req, res) => {
    const post = await db.get('SELECT id, user_id FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const existing = await db.get('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, post.id);
    if (existing) {
      await db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, post.id);
      return res.json({ liked: false });
    }

    db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', req.user.id, post.id);
    createNotification(db, { userId: post.user_id, actorId: req.user.id, type: 'like', entityType: 'post', entityId: post.id, body: `${req.user.username} liked your post` });
    res.json({ liked: true });
  });

  // ── Comment ──

  router.post('/posts/:id/comments', authRequired, async (req, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const post = await db.get('SELECT id, user_id FROM posts WHERE id = ?', req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const result = db.run('INSERT INTO comments (user_id, post_id, body) VALUES (?, ?, ?)', req.user.id, post.id, parsed.data.body);
    const comment = await db.get(`
      SELECT comments.*, users.username, users.avatar_url
      FROM comments JOIN users ON users.id = comments.user_id
      WHERE comments.id = ?
    `, result.lastInsertRowid);

    createNotification(db, { userId: post.user_id, actorId: req.user.id, type: 'comment', entityType: 'post', entityId: post.id, body: `${req.user.username} commented: ${parsed.data.body}` });
    res.status(201).json({ comment });
  });

  // ── Bookmarks ──

  router.post('/bookmarks/:postId', authRequired, async (req, res) => {
    const postId = Number(req.params.postId);
    const post = await db.get('SELECT id FROM posts WHERE id = ?', postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const existing = await db.get('SELECT 1 FROM bookmarks WHERE user_id = ? AND post_id = ?', req.user.id, post.id);
    if (existing) {
      await db.run('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?', req.user.id, post.id);
      return res.json({ bookmarked: false });
    }
    db.run('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)', req.user.id, post.id);
    res.json({ bookmarked: true });
  });

  router.get('/bookmarks', authRequired, async (req, res) => {
    const postIds = await db.all('SELECT post_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC', req.user.id).map((r) => r.post_id);
    if (postIds.length === 0) return res.json({ posts: [] });
    const placeholder = postIds.map(() => '?').join(',');
    const posts = await getPosts(db, req.user.id, `WHERE posts.id IN (${placeholder})`, postIds, 100);
    const map = {};
    posts.forEach((p) => { map[p.id] = p; });
    res.json({ posts: postIds.map((id) => map[id]).filter(Boolean) });
  });

  // ── Block / unblock user ──

  router.post('/blocks/:userId', authRequired, async (req, res) => {
    const userId = Number(req.params.userId);
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot block yourself' });
    const target = await db.get('SELECT id FROM users WHERE id = ?', userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const existing = await db.get('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, target.id);
    if (existing) {
      await db.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', req.user.id, target.id);
      return res.json({ blocked: false });
    }
    db.run('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', req.user.id, target.id);
    res.json({ blocked: true });
  });

  router.get('/blocks', authRequired, async (req, res) => {
    const blocked = await db.all(`
      SELECT users.id, users.username, users.avatar_url, blocks.created_at
      FROM blocks JOIN users ON users.id = blocks.blocked_id
      WHERE blocks.blocker_id = ? ORDER BY blocks.created_at DESC
    `, req.user.id);
    res.json({ blocked });
  });

  return router;
}
