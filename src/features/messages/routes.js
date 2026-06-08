import express from 'express';
import { authRequired } from '../../lib/http.js';
import { createNotification } from '../../lib/notifications.js';
import { emitMessage } from '../../lib/realtime.js';
import { messageSchema } from '../../lib/schemas.js';

export function createMessagesRouter({ db }) {
  const router = express.Router();

  router.get('/messages/threads', authRequired, (req, res) => {
    const threads = db.prepare(`
      SELECT users.id, users.username, users.avatar_url, MAX(messages.created_at) AS last_message_at
      FROM messages
      JOIN users ON users.id = CASE WHEN messages.sender_id = ? THEN messages.recipient_id ELSE messages.sender_id END
      WHERE messages.sender_id = ? OR messages.recipient_id = ?
      GROUP BY users.id
      ORDER BY last_message_at DESC
    `).all(req.user.id, req.user.id, req.user.id);
    res.json({ threads });
  });

  router.get('/messages/stream', authRequired, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, user_id: req.user.id, preferred: 'socket.io' })}\n\n`);
    res.end();
  });

  router.get('/messages/:username', authRequired, (req, res) => {
    const other = db.prepare('SELECT id, username, avatar_url FROM users WHERE username = ?').get(req.params.username);
    if (!other) return res.status(404).json({ error: 'User not found' });
    const messages = db.prepare(`
      SELECT messages.*, sender.username AS sender_username, recipient.username AS recipient_username
      FROM messages
      JOIN users sender ON sender.id = messages.sender_id
      JOIN users recipient ON recipient.id = messages.recipient_id
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
      ORDER BY messages.created_at ASC, messages.id ASC
      LIMIT 100
    `).all(req.user.id, other.id, other.id, req.user.id);
    db.prepare('UPDATE messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE sender_id = ? AND recipient_id = ?').run(other.id, req.user.id);
    res.json({ user: other, messages });
  });

  router.post('/messages/:username', authRequired, (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const recipient = db.prepare('SELECT id, username FROM users WHERE username = ?').get(req.params.username);
    if (!recipient) return res.status(404).json({ error: 'User not found' });
    if (recipient.id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself' });

    const result = db.prepare('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)').run(req.user.id, recipient.id, parsed.data.body);
    const message = db.prepare(`
      SELECT messages.*, sender.username AS sender_username, recipient.username AS recipient_username
      FROM messages
      JOIN users sender ON sender.id = messages.sender_id
      JOIN users recipient ON recipient.id = messages.recipient_id
      WHERE messages.id = ?
    `).get(result.lastInsertRowid);
    createNotification(db, { userId: recipient.id, actorId: req.user.id, type: 'message', entityType: 'message', entityId: message.id, body: `${req.user.username}: ${parsed.data.body}` });
    emitMessage(req.app.locals.context?.io, message);
    res.status(201).json({ message });
  });

  return router;
}
