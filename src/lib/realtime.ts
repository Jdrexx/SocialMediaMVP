import { Server } from 'socket.io';
import { getUserFromCookieHeader } from './auth';

function publicCallUser(user) {
  return { id: user.id, username: user.username, avatar_url: user.avatar_url };
}

async function getRecipient(db, senderId, recipientId) {
  if (!recipientId) return null;
  return await db.get(`
    SELECT users.id, users.username, users.avatar_url, users.is_suspended
    FROM users
    WHERE users.id = ? AND users.is_suspended = 0
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
  `, Number(recipientId), senderId, senderId, senderId, senderId);
}

export async function attachRealtimeServer(httpServer, { db, jwtSecret, config = null as any }) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.PUBLIC_URL || true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const user = await getUserFromCookieHeader(socket.handshake.headers.cookie, db, jwtSecret);
    if (!user || user.is_suspended || !user.onboarding_complete || (config?.requireEmailVerification && !user.email_verified)) {
      return next(new Error('Unauthorized'));
    }
    socket.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.user!;
    const publicUser = { id: user.id, username: user.username, avatar_url: user.avatar_url };
    socket.emit('connected', { ok: true, user_id: user.id });

    socket.on('typing:start', async ({ recipientId } = {}) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (recipient) socket.to(`user:${recipient.id}`).emit('typing:start', { userId: user.id, username: user.username });
    });

    socket.on('typing:stop', async ({ recipientId } = {}) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (recipient) socket.to(`user:${recipient.id}`).emit('typing:stop', { userId: user.id, username: user.username });
    });

    socket.on('video:call', async ({ recipientId } = {}, ack) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (!recipient) {
        ack?.({ ok: false, error: 'Recipient is unavailable' });
        return;
      }
      io.to(`user:${recipient.id}`).emit('video:incoming', { caller: publicUser });
      ack?.({ ok: true, recipient: publicCallUser(recipient) });
    });

    socket.on('video:accept', async ({ recipientId } = {}) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (recipient) socket.to(`user:${recipient.id}`).emit('video:accepted', { by: publicUser });
    });

    socket.on('video:reject', async ({ recipientId } = {}) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (recipient) socket.to(`user:${recipient.id}`).emit('video:rejected', { by: publicUser });
    });

    socket.on('video:end', async ({ recipientId } = {}) => {
      const recipient = await getRecipient(db, user.id, recipientId);
      if (recipient) socket.to(`user:${recipient.id}`).emit('video:ended', { by: publicUser });
    });

    socket.on('webrtc:offer', async ({ recipientId, description } = {}) => {
      const recipient = description ? await getRecipient(db, user.id, recipientId) : null;
      if (recipient) socket.to(`user:${recipient.id}`).emit('webrtc:offer', { from: publicUser, description });
    });

    socket.on('webrtc:answer', async ({ recipientId, description } = {}) => {
      const recipient = description ? await getRecipient(db, user.id, recipientId) : null;
      if (recipient) socket.to(`user:${recipient.id}`).emit('webrtc:answer', { from: publicUser, description });
    });

    socket.on('webrtc:ice-candidate', async ({ recipientId, candidate } = {}) => {
      const recipient = candidate ? await getRecipient(db, user.id, recipientId) : null;
      if (recipient) socket.to(`user:${recipient.id}`).emit('webrtc:ice-candidate', { from: publicUser, candidate });
    });
  });

  return io;
}

export function emitMessage(io, message) {
  if (!io || !message) return;
  io.to(`user:${message.recipient_id}`).emit('message:new', { message });
  io.to(`user:${message.sender_id}`).emit('message:new', { message });
}
