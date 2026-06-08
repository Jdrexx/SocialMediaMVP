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

test('registers and returns current user session', async () => {
  const { app } = setup();
  const res = await register(app, 'alice', 'alice@example.com');
  assert.equal(res.status, 201);
  assert.equal(res.body.user.username, 'alice');
  assert.ok(res.headers['set-cookie'][0].includes('token='));

  const me = await request(app).get('/api/me').set('Cookie', res.headers['set-cookie']);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'alice@example.com');
});

test('logs in, creates a post, lists feed, likes and comments', async () => {
  const { app } = setup();
  await register(app, 'alice', 'alice@example.com');
  await register(app, 'bob', 'bob@example.com');

  const login = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Password123!' });
  const cookie = login.headers['set-cookie'];

  const created = await request(app).post('/api/posts').set('Cookie', cookie).send({ body: 'Hello social world!' });
  assert.equal(created.status, 201);
  assert.equal(created.body.post.body, 'Hello social world!');

  const liked = await request(app).post(`/api/posts/${created.body.post.id}/like`).set('Cookie', cookie);
  assert.equal(liked.status, 200);
  assert.equal(liked.body.liked, true);

  const commented = await request(app).post(`/api/posts/${created.body.post.id}/comments`).set('Cookie', cookie).send({ body: 'First!' });
  assert.equal(commented.status, 201);
  assert.equal(commented.body.comment.body, 'First!');

  const feed = await request(app).get('/api/feed').set('Cookie', cookie);
  assert.equal(feed.status, 200);
  assert.equal(feed.body.posts[0].like_count, 1);
  assert.equal(feed.body.posts[0].comment_count, 1);
});

test('follows users and feed prioritizes followed accounts plus self', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice', 'alice@example.com');
  const bob = await register(app, 'bob', 'bob@example.com');
  const bobCookie = bob.headers['set-cookie'];
  const aliceCookie = alice.headers['set-cookie'];

  const bobPost = await request(app).post('/api/posts').set('Cookie', bobCookie).send({ body: 'Bob update' });
  assert.equal(bobPost.status, 201);

  const follow = await request(app).post('/api/users/bob/follow').set('Cookie', aliceCookie);
  assert.equal(follow.status, 200);
  assert.equal(follow.body.following, true);

  const feed = await request(app).get('/api/feed').set('Cookie', aliceCookie);
  assert.equal(feed.status, 200);
  assert.equal(feed.body.posts[0].username, 'bob');
});

test('rejects unauthenticated post creation', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/posts').send({ body: 'Nope' });
  assert.equal(res.status, 401);
});
