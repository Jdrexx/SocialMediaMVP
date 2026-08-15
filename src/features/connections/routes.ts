// @ts-nocheck
import express from 'express';
import { memberRequired } from '../../lib/http';
import { createNotification } from '../../lib/notifications';
import { connectionResponseSchema } from '../../lib/schemas';
import { connectionStatus, isBlockedEitherWay, serializeMemberProfile } from '../../lib/membership';
import { publicUser } from '../../lib/auth';

export function createConnectionsRouter({ db }) {
  const router = express.Router();

  async function connectionMember(user) {
    const profile = await db.get('SELECT * FROM member_profiles WHERE user_id = ?', user.id);
    return { ...publicUser(user), member_profile: serializeMemberProfile(profile, false) };
  }

  router.get('/connections', memberRequired, async (req, res) => {
    const rows = await db.all(`
      SELECT connections.*,
        requester.username AS requester_username, requester.avatar_url AS requester_avatar_url,
        recipient.username AS recipient_username, recipient.avatar_url AS recipient_avatar_url
      FROM connections
      JOIN users requester ON requester.id = connections.requester_id
      JOIN users recipient ON recipient.id = connections.recipient_id
      WHERE (connections.requester_id = ? OR connections.recipient_id = ?)
        AND requester.is_suspended = 0 AND recipient.is_suspended = 0
      ORDER BY connections.updated_at DESC, connections.id DESC
    `, req.user.id, req.user.id);

    const accepted = [];
    const incoming = [];
    const outgoing = [];
    for (const row of rows) {
      if (await isBlockedEitherWay(db, row.requester_id, row.recipient_id)) continue;
      const isRequester = row.requester_id === req.user.id;
      const member = {
        id: isRequester ? row.recipient_id : row.requester_id,
        username: isRequester ? row.recipient_username : row.requester_username,
        avatar_url: isRequester ? row.recipient_avatar_url : row.requester_avatar_url
      };
      const item = { id: row.id, status: row.status, member, created_at: row.created_at, updated_at: row.updated_at };
      if (row.status === 'accepted') accepted.push(item);
      else if (row.status === 'pending' && isRequester) outgoing.push(item);
      else if (row.status === 'pending') incoming.push(item);
    }
    res.json({ accepted, incoming, outgoing });
  });

  router.get('/connections/status/:username', memberRequired, async (req, res) => {
    const target = await db.get('SELECT id FROM users WHERE username = ? AND is_suspended = 0', req.params.username);
    if (!target || await isBlockedEitherWay(db, req.user.id, target.id)) return res.status(404).json({ error: 'User not found' });
    res.json({ status: await connectionStatus(db, req.user.id, target.id) });
  });

  router.post('/connections/:username/request', memberRequired, async (req, res) => {
    const target = await db.get(`
      SELECT users.* FROM users
      JOIN member_profiles ON member_profiles.user_id = users.id
      WHERE users.username = ? AND users.is_suspended = 0 AND member_profiles.discoverable = 1
    `, req.params.username);
    if (!target || target.id === req.user.id || await isBlockedEitherWay(db, req.user.id, target?.id)) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existing = await db.get(`
      SELECT * FROM connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
      ORDER BY id DESC LIMIT 1
    `, req.user.id, target.id, target.id, req.user.id);
    if (existing?.status === 'accepted') return res.status(409).json({ error: 'You are already connected' });
    if (existing?.status === 'pending') return res.status(409).json({ error: 'A connection request is already pending' });
    if (existing) await db.run('DELETE FROM connections WHERE id = ?', existing.id);
    const result = await db.run('INSERT INTO connections (requester_id, recipient_id) VALUES (?, ?)', req.user.id, target.id);
    await createNotification(db, {
      userId: target.id,
      actorId: req.user.id,
      type: 'connection_request',
      entityType: 'connection',
      entityId: result.lastInsertRowid,
      body: `${req.user.username} would like to connect`
    });
    res.status(201).json({ id: result.lastInsertRowid, status: 'outgoing_pending', member: await connectionMember(target) });
  });

  router.post('/connections/:id/respond', memberRequired, async (req, res) => {
    const parsed = connectionResponseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const connection = await db.get('SELECT * FROM connections WHERE id = ? AND recipient_id = ? AND status = ?', req.params.id, req.user.id, 'pending');
    if (!connection || await isBlockedEitherWay(db, connection.requester_id, connection.recipient_id)) {
      return res.status(404).json({ error: 'Connection request not found' });
    }
    const nextStatus = parsed.data.action === 'accept' ? 'accepted' : 'declined';
    await db.run('UPDATE connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', nextStatus, connection.id);
    if (nextStatus === 'accepted') {
      await createNotification(db, {
        userId: connection.requester_id,
        actorId: req.user.id,
        type: 'connection_accepted',
        entityType: 'connection',
        entityId: connection.id,
        body: `${req.user.username} accepted your connection request`
      });
    }
    res.json({ id: connection.id, status: nextStatus });
  });

  router.delete('/connections/:username', memberRequired, async (req, res) => {
    const target = await db.get('SELECT id FROM users WHERE username = ?', req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const result = await db.run(`
      DELETE FROM connections
      WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    `, req.user.id, target.id, target.id, req.user.id);
    if (!result.changes) return res.status(404).json({ error: 'Connection not found' });
    res.json({ ok: true });
  });

  return router;
}
