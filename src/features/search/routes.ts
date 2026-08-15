// @ts-nocheck
import express from 'express';
import { memberRequired } from '../../lib/http';
import { connectionStatus, publicMember } from '../../lib/membership';
import { getPosts } from '../../lib/posts';

export function createSearchRouter({ db }) {
  const router = express.Router();

  router.get('/search', memberRequired, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [], posts: [] });
    const like = `%${q}%`;
    const rows = await db.all(`
      SELECT users.* FROM users
      JOIN member_profiles ON member_profiles.user_id = users.id
      WHERE users.is_suspended = 0
        AND member_profiles.discoverable = 1
        AND users.id != ?
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocks.blocker_id = ? AND blocks.blocked_id = users.id)
             OR (blocks.blocker_id = users.id AND blocks.blocked_id = ?)
        )
        AND (users.username LIKE ? OR users.bio LIKE ? OR member_profiles.city LIKE ? OR member_profiles.region LIKE ?
          OR member_profiles.connection_intents LIKE ?
          OR (member_profiles.show_experience_tags = 1 AND member_profiles.experience_tags LIKE ?))
      ORDER BY users.username ASC
      LIMIT 20
    `, req.user.id, req.user.id, req.user.id, like, like, like, like, like, like);
    const users = (await Promise.all(rows.map(async (row) => {
      const member = await publicMember(db, row);
      return member ? { ...member, connection_status: await connectionStatus(db, req.user.id, row.id) } : null;
    }))).filter(Boolean);
    const posts = await getPosts(db, req.user.id, 'WHERE (posts.body LIKE ? OR users.username LIKE ?)', [like, like]);
    res.json({ query: q, users, posts });
  });

  return router;
}
