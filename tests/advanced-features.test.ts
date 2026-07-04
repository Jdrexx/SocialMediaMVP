// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register } from './helper';

test('uploads media and attaches it to a post without requiring an image URL', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice', 'alice@example.com');
  const cookie = alice.headers['set-cookie'];

  const upload = await request(app)
    .post('/api/uploads')
    .set('Cookie', cookie)
    .attach('media', Buffer.from('fake image bytes'), { filename: 'photo.png', contentType: 'image/png' });

  assert.equal(upload.status, 201);
  assert.match(upload.body.media.url, /^\/uploads\//);

  const post = await request(app)
    .post('/api/posts')
    .set('Cookie', cookie)
    .send({ body: 'Post with upload', media_id: upload.body.media.id });

  assert.equal(post.status, 201);
  assert.equal(post.body.post.media_url, upload.body.media.url);
});

test('creates notifications for likes, comments, follows and marks them read', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice', 'alice@example.com');
  const bob = await register(app, 'bob', 'bob@example.com');
  const aliceCookie = alice.headers['set-cookie'];
  const bobCookie = bob.headers['set-cookie'];

  const post = await request(app).post('/api/posts').set('Cookie', aliceCookie).send({ body: 'Notify me' });
  await request(app).post(`/api/posts/${post.body.post.id}/like`).set('Cookie', bobCookie);
  await request(app).post(`/api/posts/${post.body.post.id}/comments`).set('Cookie', bobCookie).send({ body: 'Nice' });
  await request(app).post('/api/users/alice/follow').set('Cookie', bobCookie);

  const notifications = await request(app).get('/api/notifications').set('Cookie', aliceCookie);
  assert.equal(notifications.status, 200);
  assert.equal(notifications.body.notifications.length, 3);
  assert.deepEqual(notifications.body.notifications.map((n) => n.type).sort(), ['comment', 'follow', 'like']);

  const read = await request(app).post(`/api/notifications/${notifications.body.notifications[0].id}/read`).set('Cookie', aliceCookie);
  assert.equal(read.status, 200);
  assert.equal(read.body.ok, true);
});

test('searches users and posts', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice_search', 'alice@example.com');
  await request(app).post('/api/posts').set('Cookie', alice.headers['set-cookie']).send({ body: 'Learning SQLite search' });

  const res = await request(app).get('/api/search?q=sqlite');
  assert.equal(res.status, 200);
  assert.equal(res.body.posts[0].body, 'Learning SQLite search');

  const users = await request(app).get('/api/search?q=alice_search');
  assert.equal(users.status, 200);
  assert.equal(users.body.users[0].username, 'alice_search');
});

test('supports password reset and email verification token flows', async () => {
  const { app } = setup();
  await register(app, 'alice', 'alice@example.com');

  const resetRequest = await request(app).post('/api/auth/password-reset/request').send({ email: 'alice@example.com' });
  assert.equal(resetRequest.status, 200);
  assert.ok(resetRequest.body.dev_token);

  const resetConfirm = await request(app).post('/api/auth/password-reset/confirm').send({ token: resetRequest.body.dev_token, password: 'NewPassword123!' });
  assert.equal(resetConfirm.status, 200);

  const login = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'NewPassword123!' });
  assert.equal(login.status, 200);

  const verifyRequest = await request(app).post('/api/auth/email-verification/request').set('Cookie', login.headers['set-cookie']);
  assert.equal(verifyRequest.status, 200);
  assert.ok(verifyRequest.body.dev_token);

  const verifyConfirm = await request(app).post('/api/auth/email-verification/confirm').send({ token: verifyRequest.body.dev_token });
  assert.equal(verifyConfirm.status, 200);
  assert.equal(verifyConfirm.body.user.email_verified, true);
});

test('first registered user can moderate reports and remove posts', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const bob = await register(app, 'bob', 'bob@example.com');
  const adminCookie = admin.headers['set-cookie'];
  const bobCookie = bob.headers['set-cookie'];

  const post = await request(app).post('/api/posts').set('Cookie', bobCookie).send({ body: 'Spam post' });
  const report = await request(app).post(`/api/reports/posts/${post.body.post.id}`).set('Cookie', adminCookie).send({ reason: 'spam' });
  assert.equal(report.status, 201);

  const reports = await request(app).get('/api/admin/reports').set('Cookie', adminCookie);
  assert.equal(reports.status, 200);
  assert.equal(reports.body.reports[0].reason, 'spam');

  const removed = await request(app).delete(`/api/admin/posts/${post.body.post.id}`).set('Cookie', adminCookie);
  assert.equal(removed.status, 200);
});

test('sends chat messages and exposes stream endpoint for realtime clients', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice', 'alice@example.com');
  await register(app, 'bob', 'bob@example.com');
  const aliceCookie = alice.headers['set-cookie'];

  const sent = await request(app).post('/api/messages/bob').set('Cookie', aliceCookie).send({ body: 'Hello Bob' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.body, 'Hello Bob');

  const thread = await request(app).get('/api/messages/bob').set('Cookie', aliceCookie);
  assert.equal(thread.status, 200);
  assert.equal(thread.body.messages[0].body, 'Hello Bob');

  const stream = await request(app).get('/api/messages/stream').set('Cookie', aliceCookie).buffer(true).parse((res, done) => {
    res.once('data', (chunk) => done(null, chunk.toString()));
  });
  assert.equal(stream.status, 200);
  assert.match(stream.text || stream.body, /connected/);
});
