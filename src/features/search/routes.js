import express from 'express';
import { publicUser } from '../../lib/auth.js';
import { getPosts } from '../../lib/posts.js';

export function createSearchRouter({ db }) {
  const router = express.Router();

  router.get('/search', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [], posts: [] });
    const like = `%${q}%`;
    const users = db.prepare(`
      SELECT * FROM users
      WHERE is_suspended = 0 AND (username LIKE ? OR bio LIKE ?)
      ORDER BY username ASC
      LIMIT 20
    `).all(like, like).map(publicUser);
    const posts = getPosts(db, req.user?.id, 'WHERE (posts.body LIKE ? OR users.username LIKE ?)', [like, like]);
    res.json({ query: q, users, posts });
  });

  return router;
}
