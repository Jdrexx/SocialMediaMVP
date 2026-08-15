// @ts-nocheck
export async function serializePost(row, db, viewerId = 0) {
  const comments = await db.all(`
    SELECT comments.*, users.username, users.avatar_url
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
      AND users.is_suspended = 0
      AND NOT EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocks.blocker_id = ? AND blocks.blocked_id = comments.user_id)
           OR (blocks.blocker_id = comments.user_id AND blocks.blocked_id = ?)
      )
    ORDER BY comments.created_at ASC
    LIMIT 20
  `, row.id, viewerId, viewerId);

  const mediaUrl = row.media_url || row.image_url || '';
  return {
    ...row,
    media_url: mediaUrl,
    liked_by_me: Boolean(row.liked_by_me),
    comments
  };
}

export async function getPosts(db, viewerId, whereSql = '', params = [], limit = 50) {
  const rows = await db.all(`
    SELECT posts.*, users.username, users.avatar_url, media.url AS media_url, media.mime_type AS media_type,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked_by_me
    FROM posts
    JOIN users ON users.id = posts.user_id
    LEFT JOIN media ON media.id = posts.media_id
    ${whereSql ? `${whereSql} AND` : 'WHERE'} posts.is_hidden = 0
      AND users.is_suspended = 0
      AND NOT EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocks.blocker_id = ? AND blocks.blocked_id = posts.user_id)
           OR (blocks.blocker_id = posts.user_id AND blocks.blocked_id = ?)
      )
    ORDER BY posts.created_at DESC, posts.id DESC
    LIMIT ?
  `, viewerId ?? 0, ...params, viewerId ?? 0, viewerId ?? 0, limit);

  return await Promise.all(rows.map((row) => serializePost(row, db, viewerId ?? 0)));
}
