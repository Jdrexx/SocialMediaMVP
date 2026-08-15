// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app';
import { createDatabase } from '../src/lib/database';
import { createTables } from '../src/db';
import { getRuntimeConfig } from '../src/lib/env';
import { registrationPayload } from './helper';

function setup() {
  const db = createDatabase('sqlite::memory:');
  createTables(db);
  const app = createApp({ db, jwtSecret: 'test-secret' });
  return { app, db };
}

async function register(app) {
  return request(app).post('/api/auth/register').send(registrationPayload('alice', 'alice@example.com'));
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

  const config = getRuntimeConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DATA_ENCRYPTION_KEY: 'a'.repeat(64), DB_FILE: '/data/social.sqlite', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' });
  assert.equal(config.isProduction, true);
  assert.equal(config.cookieSecure, true);
  assert.equal(config.dbFile, '/data/social.sqlite');
});

test('plain DB_FILE paths use persistent SQLite rather than an in-memory database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mysazz-db-'));
  const dbFile = join(directory, 'persistent.sqlite');
  try {
    const first = createDatabase(dbFile);
    createTables(first);
    first.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', 'persistent_user', 'persistent@example.com', 'hash');
    first.close();

    const reopened = createDatabase(dbFile);
    assert.equal(reopened.get('SELECT username FROM users WHERE email = ?', 'persistent@example.com').username, 'persistent_user');
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
