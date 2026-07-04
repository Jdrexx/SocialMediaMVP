// @ts-nocheck
export async function createNotification(db, { userId, actorId, type, entityType, entityId, body = '' }) {
  if (!userId || userId === actorId) return null;
  const result = await db.run(
    'INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, body) VALUES (?, ?, ?, ?, ?, ?)',
    userId, actorId || null, type, entityType, entityId, body
  );
  return result.lastInsertRowid;
}
