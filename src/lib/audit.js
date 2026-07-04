export function logAdminAction(db, { adminId, action, targetType, targetId, details = '' }) {
  db.prepare('INSERT INTO activity_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, action, targetType, targetId, details);
}
