import { Server } from 'socket.io';
import { getUserFromCookieHeader } from './auth.js';

export function attachRealtimeServer(httpServer, { db, jwtSecret }) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

  io.use((socket, next) => {
    const user = getUserFromCookieHeader(socket.handshake.headers.cookie, db, jwtSecret);
    if (!user || user.is_suspended) return next(new Error('Unauthorized'));
    socket.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on('connection', (socket) => {
    socket.emit('connected', { ok: true, user_id: socket.user.id });

    socket.on('typing:start', ({ recipientId }) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('typing:start', { userId: socket.user.id, username: socket.user.username });
    });

    socket.on('typing:stop', ({ recipientId }) => {
      if (recipientId) socket.to(`user:${recipientId}`).emit('typing:stop', { userId: socket.user.id, username: socket.user.username });
    });
  });

  return io;
}

export function emitMessage(io, message) {
  if (!io || !message) return;
  io.to(`user:${message.recipient_id}`).emit('message:new', { message });
  io.to(`user:${message.sender_id}`).emit('message:new', { message });
}
