export function serializePost(row, db) {
  const comments = db.prepare(`
    SELECT comments.*, users.username, users.avatar_url
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at ASC
    LIMIT 20
  `).all(row.id);

  return {
    ...row,
    liked_by_me: Boolean(row.liked_by_me),
    comments
  };
}

export function getPosts(db, viewerId, whereSql = '', params = []) {
  const rows = db.prepare(`
    SELECT posts.*, users.username, users.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked_by_me
    FROM posts JOIN users ON users.id = posts.user_id
    ${whereSql}
    ORDER BY posts.created_at DESC, posts.id DESC
    LIMIT 50
  `).all(viewerId ?? 0, ...params);

  return rows.map((row) => serializePost(row, db));
}
