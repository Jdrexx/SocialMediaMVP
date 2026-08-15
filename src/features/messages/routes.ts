// @ts-nocheck
import express from 'express';
import { memberRequired } from '../../lib/http';
import { createNotification } from '../../lib/notifications';
import { emitMessage } from '../../lib/realtime';
import { messageSchema } from '../../lib/schemas';
import { areConnected } from '../../lib/membership';
import { decryptSensitive, encryptSensitive } from '../../lib/crypto';

export function createMessagesRouter({ db, config }) {
  const router = express.Router();

  router.get('/messages/threads', memberRequired, async (req, res) => {
    const threads = await db.all(`
      SELECT users.id, users.username, users.avatar_url, MAX(messages.created_at) AS last_message_at
      FROM messages
      JOIN users ON users.id = CASE WHEN messages.sender_id = ? THEN messages.recipient_id ELSE messages.sender_id END
      WHERE (messages.sender_id = ? OR messages.recipient_id = ?)
      AND EXISTS (
        SELECT 1 FROM connections
        WHERE connections.status = 'accepted'
          AND ((connections.requester_id = ? AND connections.recipient_id = users.id)
            OR (connections.requester_id = users.id AND connections.recipient_id = ?))
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocks.blocker_id = ? AND blocks.blocked_id = users.id)
           OR (blocks.blocker_id = users.id AND blocks.blocked_id = ?)
      )
      GROUP BY users.id
      ORDER BY last_message_at DESC
    `, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    res.json({ threads });
  });

  router.get('/messages/stream', memberRequired, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, user_id: req.user.id, preferred: 'socket.io' })}\n\n`);
    res.end();
  });

  router.get('/messages/:username', memberRequired, async (req, res) => {
    const other = await db.get('SELECT id, username, avatar_url FROM users WHERE username = ?', req.params.username);
    if (!other) return res.status(404).json({ error: 'User not found' });
    if (!(await areConnected(db, req.user.id, other.id))) return res.status(403).json({ error: 'An accepted connection is required before messaging' });
    const messages = await db.all(`
      SELECT messages.*, sender.username AS sender_username, recipient.username AS recipient_username
      FROM messages
      JOIN users sender ON sender.id = messages.sender_id
      JOIN users recipient ON recipient.id = messages.recipient_id
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
      ORDER BY messages.created_at ASC, messages.id ASC
      LIMIT 100
    `, req.user.id, other.id, other.id, req.user.id);
    await db.run('UPDATE messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE sender_id = ? AND recipient_id = ?', other.id, req.user.id);
    res.json({ user: other, messages: messages.map((message) => ({ ...message, body: decryptSensitive(message.body, config.dataEncryptionKey) })) });
  });

  router.post('/messages/:username', memberRequired, async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const recipient = await db.get('SELECT id, username FROM users WHERE username = ?', req.params.username);
    if (!recipient) return res.status(404).json({ error: 'User not found' });
    if (recipient.id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself' });
    if (!(await areConnected(db, req.user.id, recipient.id))) return res.status(403).json({ error: 'An accepted connection is required before messaging' });

    const encryptedBody = encryptSensitive(parsed.data.body, config.dataEncryptionKey);
    const result = await db.run('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)', req.user.id, recipient.id, encryptedBody);
    const message = await db.get(`
      SELECT messages.*, sender.username AS sender_username, recipient.username AS recipient_username
      FROM messages
      JOIN users sender ON sender.id = messages.sender_id
      JOIN users recipient ON recipient.id = messages.recipient_id
      WHERE messages.id = ?
    `, result.lastInsertRowid);
    const publicMessage = { ...message, body: parsed.data.body };
    await createNotification(db, { userId: recipient.id, actorId: req.user.id, type: 'message', entityType: 'message', entityId: message.id, body: `${req.user.username} sent you a message` });
    emitMessage(req.app.locals.context?.io, publicMessage);
    res.status(201).json({ message: publicMessage });
  });

  return router;
}
