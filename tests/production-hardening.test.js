import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db.js';
import { getRuntimeConfig } from '../src/lib/env.js';

function setup() {
  const db = createDatabase(':memory:');
  const app = createApp({ db, jwtSecret: 'test-secret' });
  return { app, db };
}

async function register(app) {
  return request(app).post('/api/auth/register').send({ username: 'alice', email: 'alice@example.com', password: 'Password123!' });
}

test('sets profile avatar and cover images from authenticated uploads', async () => {
  const { app } = setup();
  const alice = await register(app);
  const cookie = alice.headers['set-cookie'];

  const avatar = await request(app)
    .post('/api/uploads')
    .set('Cookie', cookie)
    .attach('media', Buffer.from('avatar image'), { filename: 'avatar.png', contentType: 'image/png' });
  const cover = await request(app)
    .post('/api/uploads')
    .set('Cookie', cookie)
    .attach('media', Buffer.from('cover image'), { filename: 'cover.jpg', contentType: 'image/jpeg' });

  const avatarSet = await request(app).post('/api/me/avatar').set('Cookie', cookie).send({ media_id: avatar.body.media.id });
  assert.equal(avatarSet.status, 200);
  assert.equal(avatarSet.body.user.avatar_url, avatar.body.media.url);

  const coverSet = await request(app).post('/api/me/cover').set('Cookie', cookie).send({ media_id: cover.body.media.id });
  assert.equal(coverSet.status, 200);
  assert.equal(coverSet.body.user.cover_url, cover.body.media.url);
});

test('production config rejects weak secrets and missing persistent database', () => {
  assert.throws(() => getRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => getRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) }), /DB_FILE|DATABASE_URL/);

  const config = getRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DB_FILE: '/data/social.sqlite', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' });
  assert.equal(config.isProduction, true);
  assert.equal(config.cookieSecure, true);
  assert.equal(config.dbFile, '/data/social.sqlite');
});
