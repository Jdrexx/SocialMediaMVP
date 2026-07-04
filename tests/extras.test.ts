// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, register } from './helper';

test('edit own post', async () => {
  const { app } = setup();
  const u = await register(app, 'alice', 'a@t.com');
  const c = u.headers['set-cookie'];
  const post = await request(app).post('/api/posts').set('Cookie', c).send({ body: 'Original' });
  const edited = await request(app).patch(`/api/posts/${post.body.post.id}`).set('Cookie', c).send({ body: 'Edited' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.post.body, 'Edited');
  assert.equal(edited.body.post.edited, 1);
});

test('bookmark and unbookmark post', async () => {
  const { app } = setup();
  const u = await register(app, 'alice', 'a@t.com');
  const c = u.headers['set-cookie'];
  const post = await request(app).post('/api/posts').set('Cookie', c).send({ body: 'Bookmark me' });

  const add = await request(app).post(`/api/bookmarks/${post.body.post.id}`).set('Cookie', c);
  assert.equal(add.body.bookmarked, true);

  const bookmarks = await request(app).get('/api/bookmarks').set('Cookie', c);
  assert.equal(bookmarks.body.posts.length, 1);

  const remove = await request(app).post(`/api/bookmarks/${post.body.post.id}`).set('Cookie', c);
  assert.equal(remove.body.bookmarked, false);
});

test('block and unblock user', async () => {
  const { app } = setup();
  const a = await register(app, 'alice', 'a@t.com');
  const b = await register(app, 'bob', 'b@t.com');
  const ac = a.headers['set-cookie'];
  const bc = b.headers['set-cookie'];

  const block = await request(app).post('/api/blocks/2').set('Cookie', ac);
  assert.equal(block.body.blocked, true);

  const blocks = await request(app).get('/api/blocks').set('Cookie', ac);
  assert.equal(blocks.body.blocked.length, 1);
  assert.equal(blocks.body.blocked[0].username, 'bob');

  const unblock = await request(app).post('/api/blocks/2').set('Cookie', ac);
  assert.equal(unblock.body.blocked, false);
});

test('change password', async () => {
  const { app } = setup();
  const u = await register(app, 'alice', 'a@t.com');
  const c = u.headers['set-cookie'];

  const change = await request(app).post('/api/auth/change-password').set('Cookie', c)
    .send({ current_password: 'Password123!', new_password: 'NewPass1234!' });
  assert.equal(change.status, 200);

  // Old password should fail
  const login = await request(app).post('/api/auth/login').send({ email: 'a@t.com', password: 'Password123!' });
  assert.equal(login.status, 401);

  // New password works
  const login2 = await request(app).post('/api/auth/login').send({ email: 'a@t.com', password: 'NewPass1234!' });
  assert.equal(login2.status, 200);
});

test('admin can edit post content', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'a@t.com');
  const ac = admin.headers['set-cookie'];
  const user = await register(app, 'user', 'u@t.com');
  const uc = user.headers['set-cookie'];

  const post = await request(app).post('/api/posts').set('Cookie', uc).send({ body: 'Original content' });
  const edit = await request(app).patch(`/api/admin/posts/${post.body.post.id}`).set('Cookie', ac).send({ body: 'Admin edited' });
  assert.equal(edit.status, 200);
});

test('admin bulk actions', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'a@t.com');
  const ac = admin.headers['set-cookie'];
  await register(app, 'use1', 'u1@t.com');
  await register(app, 'use2', 'u2@t.com');

  // Bulk suspend
  const bulk = await request(app).post('/api/admin/bulk').set('Cookie', ac)
    .send({ action: 'suspend_users', ids: [2, 3] });
  assert.equal(bulk.status, 200);
  assert.equal(bulk.body.processed, 2);

  const users = await request(app).get('/api/admin/users').set('Cookie', ac);
  const suspended = users.body.users.filter((u) => u.is_suspended === true);
  assert.equal(suspended.length, 2);
});

test('admin activity log', async () => {
  const { app } = setup();
  const admin = await register(app, 'admin', 'a@t.com');
  const ac = admin.headers['set-cookie'];
  const user = await register(app, 'user', 'u@t.com');

  await request(app).post('/api/admin/users/2/suspend').set('Cookie', ac);
  const log = await request(app).get('/api/admin/log?limit=10').set('Cookie', ac);
  assert.equal(log.status, 200);
  assert.ok(log.body.entries.length >= 1);
  assert.equal(log.body.entries[0].action, 'suspend_user');
});

test('feed pagination', async () => {
  const { app } = setup();
  const u = await register(app, 'alice', 'a@t.com');
  const c = u.headers['set-cookie'];
  for (let i = 0; i < 5; i++) {
    await request(app).post('/api/posts').set('Cookie', c).send({ body: `Post ${i}` });
  }

  const page1 = await request(app).get('/api/posts?limit=3').set('Cookie', c);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.posts.length, 3);
  assert.ok(page1.body.next);

  const page2 = await request(app).get(`/api/posts?before=${page1.body.next}&limit=3`).set('Cookie', c);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.posts.length, 2);
  assert.equal(page2.body.next, null);
});
