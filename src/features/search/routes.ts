// @ts-nocheck
import express from 'express';
import { publicUser } from '../../lib/auth';
import { getPosts } from '../../lib/posts';

export function createSearchRouter({ db }) {
  const router = express.Router();

  router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [], posts: [] });
    const like = `%${q}%`;
    const rows = await db.all(`
      SELECT * FROM users
      WHERE is_suspended = 0 AND (username LIKE ? OR bio LIKE ?)
      ORDER BY username ASC
      LIMIT 20
    `, like, like);
    const users = rows.map(publicUser);
    const posts = await getPosts(db, req.user?.id, 'WHERE (posts.body LIKE ? OR users.username LIKE ?)', [like, like]);
    res.json({ query: q, users, posts });
  });

  return router;
}
