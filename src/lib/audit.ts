// @ts-nocheck
export async function logAdminAction(db, { adminId, action, targetType, targetId, details = '' }) {
  await db.run('INSERT INTO activity_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
    adminId, action, targetType, targetId, details);
}
