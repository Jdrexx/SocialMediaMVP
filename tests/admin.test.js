import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db.js';

function setup() {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret' });
  return { app, db };
}

async function register(app, username, email, password = 'Password123!') {
  return request(app).post('/api/auth/register').send({ username, email, password });
}

test('admin stats endpoint returns platform counts', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];
  await register(app, 'user1', 'u1@example.com');
  await register(app, 'user2', 'u2@example.com');
  await request(app).post('/api/posts').set('Cookie', cookie).send({ body: 'Admin post' });
  await request(app).post('/api/users/user1/follow').set('Cookie', cookie);

  const stats = await request(app).get('/api/admin/stats').set('Cookie', cookie);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.users, 3);
  assert.equal(stats.body.admins, 1);
  assert.equal(stats.body.posts, 1);
  assert.equal(stats.body.followsTotal, 1);
});

test('admin can list, edit, suspend, and unsuspend users', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const adminCookie = admin.headers['set-cookie'];
  await register(app, 'user1', 'u1@example.com');

  const users = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
  assert.equal(users.status, 200);
  assert.equal(users.body.users.length, 2);

  const user1 = users.body.users.find((u) => u.username === 'user1');
  assert.ok(user1);

  // Suspend
  const suspend = await request(app).post(`/api/admin/users/${user1.id}/suspend`).set('Cookie', adminCookie);
  assert.equal(suspend.status, 200);
  assert.equal(suspend.body.suspended, true);

  // Unsuspend
  const unsuspend = await request(app).post(`/api/admin/users/${user1.id}/unsuspend`).set('Cookie', adminCookie);
  assert.equal(unsuspend.status, 200);
  assert.equal(unsuspend.body.suspended, false);

  // Promote to admin
  const promote = await request(app).patch(`/api/admin/users/${user1.id}`).set('Cookie', adminCookie).send({ is_admin: true });
  assert.equal(promote.status, 200);
  assert.equal(promote.body.user.is_admin, true);
});

test('admin can list all posts including hidden ones', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];
  const user1 = await register(app, 'user1', 'u1@example.com');
  const userCookie = user1.headers['set-cookie'];

  await request(app).post('/api/posts').set('Cookie', userCookie).send({ body: 'Visible post' });
  const hidden = await request(app).post('/api/posts').set('Cookie', userCookie).send({ body: 'Hidden post' });
  await request(app).delete(`/api/admin/posts/${hidden.body.post.id}`).set('Cookie', cookie);

  const allPosts = await request(app).get('/api/admin/posts').set('Cookie', cookie);
  assert.equal(allPosts.status, 200);
  assert.equal(allPosts.body.posts.length, 2);

  const hiddenFilter = await request(app).get('/api/admin/posts?hidden=1').set('Cookie', cookie);
  assert.equal(hiddenFilter.body.posts.length, 1);
});

test('admin can resolve and dismiss reports', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];
  const user1 = await register(app, 'user1', 'u1@example.com');
  const userCookie = user1.headers['set-cookie'];

  const post = await request(app).post('/api/posts').set('Cookie', userCookie).send({ body: 'Reported post' });
  await request(app).post(`/api/reports/posts/${post.body.post.id}`).set('Cookie', cookie).send({ reason: 'spam' });

  const reports = await request(app).get('/api/admin/reports').set('Cookie', cookie);
  assert.equal(reports.body.reports.length, 1);
  assert.equal(reports.body.reports[0].status, 'open');

  const resolved = await request(app).post(`/api/admin/reports/${reports.body.reports[0].id}/resolve`).set('Cookie', cookie);
  assert.equal(resolved.body.status, 'resolved');

  // Create another for dismiss test
  const post2 = await request(app).post('/api/posts').set('Cookie', userCookie).send({ body: 'Another' });
  await request(app).post(`/api/reports/posts/${post2.body.post.id}`).set('Cookie', cookie).send({ reason: 'not spam' });
  const reports2 = await request(app).get('/api/admin/reports').set('Cookie', cookie);
  const openReport = reports2.body.reports.find((r) => r.status === 'open');
  assert.ok(openReport);

  const dismissed = await request(app).post(`/api/admin/reports/${openReport.id}/dismiss`).set('Cookie', cookie);
  assert.equal(dismissed.body.status, 'dismissed');
});

test('non-admin cannot access admin routes', async () => {
  const { app } = setup();
  // First user becomes admin — register one to consume that slot
  await register(app, 'realadmin', 'admin@example.com');
  const user = await register(app, 'user', 'user@example.com');
  const cookie = user.headers['set-cookie'];

  const stats = await request(app).get('/api/admin/stats').set('Cookie', cookie);
  assert.equal(stats.status, 403);

  const users = await request(app).get('/api/admin/users').set('Cookie', cookie);
  assert.equal(users.status, 403);
});

test('admin can seed random users in batches', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];

  const seeded = await request(app).post('/api/admin/seed/users').set('Cookie', cookie).send({ count: 5 });
  assert.equal(seeded.status, 201);
  assert.equal(seeded.body.created, 5);
  assert.equal(seeded.body.users.length, 5);

  const users = await request(app).get('/api/admin/users').set('Cookie', cookie);
  assert.equal(users.body.users.length, 6); // admin(1) + 5 seeded
});

test('admin can create a specific user manually', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];

  const created = await request(app).post('/api/admin/users').set('Cookie', cookie).send({ username: 'newuser', email: 'new@test.com', password: 'TestPass123!' });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.username, 'newuser');
  assert.equal(created.body.user.email, 'new@test.com');

  const dup = await request(app).post('/api/admin/users').set('Cookie', cookie).send({ username: 'newuser', email: 'other@test.com' });
  assert.equal(dup.status, 409);
});

test('admin can delete a user', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'admin@example.com');
  const cookie = admin.headers['set-cookie'];
  const user = await register(app, 'todelete', 'todelete@test.com');

  const usersBefore = await request(app).get('/api/admin/users').set('Cookie', cookie);
  const target = usersBefore.body.users.find((u) => u.username === 'todelete');
  assert.ok(target);

  const deleted = await request(app).delete(`/api/admin/users/${target.id}`).set('Cookie', cookie);
  assert.equal(deleted.status, 200);

  const usersAfter = await request(app).get('/api/admin/users').set('Cookie', cookie);
  assert.equal(usersAfter.body.users.length, 1); // only admin remains

  // admin cannot delete self
  const selfDel = await request(app).delete(`/api/admin/users/1`).set('Cookie', cookie);
  assert.equal(selfDel.status, 400);
});
