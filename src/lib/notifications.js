export function createNotification(db, { userId, actorId, type, entityType, entityId, body = '' }) {
  if (!userId || userId === actorId) return null;
  const result = db.prepare(`
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, body)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, actorId || null, type, entityType, entityId, body);
  return result.lastInsertRowid;
}
