import { Server } from 'socket.io';
import { getUserFromCookieHeader } from './auth';

function publicCallUser(user) {
  return { id: user.id, username: user.username, avatar_url: user.avatar_url };
}

function getRecipient(db, recipientId) {
  if (!recipientId) return null;
  return db.get('SELECT id, username, avatar_url, is_suspended FROM users WHERE id = ?', Number(recipientId));
}

export async function attachRealtimeServer(httpServer, { db, jwtSecret }) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.PUBLIC_URL || true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    const user = await getUserFromCookieHeader(socket.handshake.headers.cookie, db, jwtSecret);
    if (!user || user.is_suspended) return next(new Error('Unauthorized'));
    socket.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.user!;
    const publicUser = { id: user.id, username: user.username, avatar_url: user.avatar_url };
    socket.emit('connected', { ok: true, user_id: user.id });

    socket.on('typing:start', ({ recipientId } = {}) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('typing:start', { userId: user.id, username: user.username });
    });

    socket.on('typing:stop', ({ recipientId } = {}) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('typing:stop', { userId: user.id, username: user.username });
    });

    socket.on('video:call', ({ recipientId } = {}, ack) => {
      const recipient = getRecipient(db, recipientId);
      if (!recipient || recipient.is_suspended) {
        ack?.({ ok: false, error: 'Recipient is unavailable' });
        return;
      }
      io.to(`user:${recipient.id}`).emit('video:incoming', { caller: publicUser });
      ack?.({ ok: true, recipient: publicCallUser(recipient) });
    });

    socket.on('video:accept', ({ recipientId } = {}) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('video:accepted', { by: publicUser });
    });

    socket.on('video:reject', ({ recipientId } = {}) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('video:rejected', { by: publicUser });
    });

    socket.on('video:end', ({ recipientId } = {}) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('video:ended', { by: publicUser });
    });

    socket.on('webrtc:offer', ({ recipientId, description } = {}) => {
      if (recipientId && description) socket.to(`user:${recipientId}`).emit('webrtc:offer', { from: publicUser, description });
    });

    socket.on('webrtc:answer', ({ recipientId, description } = {}) => {
      if (recipientId && description) socket.to(`user:${recipientId}`).emit('webrtc:answer', { from: publicUser, description });
    });

    socket.on('webrtc:ice-candidate', ({ recipientId, candidate } = {}) => {
      if (recipientId && candidate) socket.to(`user:${recipientId}`).emit('webrtc:ice-candidate', { from: publicUser, candidate });
    });
  });

  return io;
}

export function emitMessage(io, message) {
  if (!io || !message) return;
  io.to(`user:${message.recipient_id}`).emit('message:new', { message });
  io.to(`user:${message.sender_id}`).emit('message:new', { message });
}
