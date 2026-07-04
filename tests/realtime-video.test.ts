// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { createApp } from '../src/app';
import { createDatabase } from '../src/lib/database';
import { createTables } from '../src/db';
import { attachRealtimeServer } from '../src/lib/realtime';

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function setupRealtime() {
  const db = createDatabase('sqlite::memory:');
  createTables(db);
  const jwtSecret = 'test-secret';
  const app = createApp({ db, jwtSecret });
  const server = http.createServer(app);
  const io = await attachRealtimeServer(server, { db, jwtSecret });
  app.locals.context.io = io;
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { app, db, server, io, url };
}

async function register(app, username, email) {
  const res = await request(app).post('/api/auth/register').send({ username, email, password: 'Password123!' });
  assert.equal(res.status, 201);
  return { user: res.body.user, cookie: res.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ') };
}

function connect(url, cookie) {
  return Client(url, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    forceNew: true,
    reconnection: false
  });
}

test('Socket.IO relays video-call and WebRTC signaling events between users', async () => {
  const { app, server, io, url } = await setupRealtime();
  const alice = await register(app, 'alice_video', 'alice_video@example.com');
  const bob = await register(app, 'bob_video', 'bob_video@example.com');
  const aliceSocket = connect(url, alice.cookie);
  const bobSocket = connect(url, bob.cookie);

  try {
    await Promise.all([once(aliceSocket, 'connect'), once(bobSocket, 'connect')]);

    const incoming = once(bobSocket, 'video:incoming');
    const ack = await new Promise((resolve) => aliceSocket.emit('video:call', { recipientId: bob.user.id }, resolve));
    assert.equal(ack.ok, true);
    assert.equal(ack.recipient.username, bob.user.username);
    assert.equal((await incoming).caller.username, alice.user.username);

    const accepted = once(aliceSocket, 'video:accepted');
    bobSocket.emit('video:accept', { recipientId: alice.user.id });
    assert.equal((await accepted).by.username, bob.user.username);

    const offerReceived = once(bobSocket, 'webrtc:offer');
    aliceSocket.emit('webrtc:offer', { recipientId: bob.user.id, description: { type: 'offer', sdp: 'fake-offer' } });
    assert.deepEqual((await offerReceived).description, { type: 'offer', sdp: 'fake-offer' });

    const answerReceived = once(aliceSocket, 'webrtc:answer');
    bobSocket.emit('webrtc:answer', { recipientId: alice.user.id, description: { type: 'answer', sdp: 'fake-answer' } });
    assert.deepEqual((await answerReceived).description, { type: 'answer', sdp: 'fake-answer' });

    const iceReceived = once(bobSocket, 'webrtc:ice-candidate');
    aliceSocket.emit('webrtc:ice-candidate', { recipientId: bob.user.id, candidate: { candidate: 'fake-candidate' } });
    assert.deepEqual((await iceReceived).candidate, { candidate: 'fake-candidate' });
  } finally {
    aliceSocket.close();
    bobSocket.close();
    io.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
