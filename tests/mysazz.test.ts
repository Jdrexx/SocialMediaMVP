// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app';
import { createTables } from '../src/db';
import { createDatabase } from '../src/lib/database';
import { getRuntimeConfig } from '../src/lib/env';
import { totpCode } from '../src/lib/totp';
import { register, registrationPayload, setup } from './helper';

test('requires all MySazz eligibility and privacy attestations', async () => {
  const { app } = setup();
  const missingConsent = registrationPayload('alice_consent', 'alice.consent@example.com');
  missingConsent.member_confidentiality = false;
  const rejected = await request(app).post('/api/auth/register').send(missingConsent);
  assert.equal(rejected.status, 400);

  const accepted = await register(app, 'alice_consent', 'alice.consent@example.com');
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.user.onboarding_complete, true);
  assert.deepEqual(accepted.body.user.member_profile.connection_intents, ['friendship', 'peer_support']);
});

test('keeps sensitive profile fields private until the member opts in', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice_private', 'alice.private@example.com');
  const bob = await register(app, 'bob_private', 'bob.private@example.com');
  const aliceCookie = alice.headers['set-cookie'];
  const bobCookie = bob.headers['set-cookie'];

  await request(app).patch('/api/me').set('Cookie', aliceCookie).send({
    relationship_status: 'single',
    experience_tags: ['loss_and_grief'],
    postal_code: '90012',
    city: 'Los Angeles',
    region: 'CA',
    show_relationship_status: false,
    show_experience_tags: false
  });

  const hidden = await request(app).get('/api/users/alice_private').set('Cookie', bobCookie);
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.user.member_profile.relationship_status, '');
  assert.deepEqual(hidden.body.user.member_profile.experience_tags, []);
  assert.equal(hidden.body.user.member_profile.postal_code, undefined);
  const hiddenSearch = await request(app).get('/api/search?q=loss_and_grief').set('Cookie', bobCookie);
  assert.equal(hiddenSearch.body.users.some((user) => user.username === 'alice_private'), false);

  await request(app).patch('/api/me').set('Cookie', aliceCookie).send({ show_relationship_status: true, show_experience_tags: true });
  const visible = await request(app).get('/api/users/alice_private').set('Cookie', bobCookie);
  assert.equal(visible.body.user.member_profile.relationship_status, 'single');
  assert.deepEqual(visible.body.user.member_profile.experience_tags, ['loss_and_grief']);
  assert.equal(visible.body.user.member_profile.postal_code, undefined);
  const visibleSearch = await request(app).get('/api/search?q=loss_and_grief').set('Cookie', bobCookie);
  assert.equal(visibleSearch.body.users.some((user) => user.username === 'alice_private'), true);
});

test('requires authentication for member stories, discovery, and media', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice_media', 'alice.media@example.com');
  const cookie = alice.headers['set-cookie'];
  assert.equal((await request(app).get('/api/posts')).status, 401);
  assert.equal((await request(app).get('/api/search?q=alice')).status, 401);

  const upload = await request(app).post('/api/uploads').set('Cookie', cookie)
    .attach('media', Buffer.from('private image'), { filename: 'private.png', contentType: 'image/png' });
  assert.equal(upload.status, 201);
  assert.equal((await request(app).get(upload.body.media.url)).status, 401);
  assert.equal((await request(app).get(upload.body.media.url).set('Cookie', cookie)).status, 200);
});

test('gates encrypted messages behind mutual connections and propagates blocks', async () => {
  const { app, db } = setup();
  const alice = await register(app, 'alice_safe', 'alice.safe@example.com');
  const bob = await register(app, 'bob_safe', 'bob.safe@example.com');
  const aliceCookie = alice.headers['set-cookie'];
  const bobCookie = bob.headers['set-cookie'];

  const bobPost = await request(app).post('/api/posts').set('Cookie', bobCookie).send({ body: 'Bob story' });
  assert.equal(bobPost.status, 201);
  assert.equal((await request(app).post('/api/messages/bob_safe').set('Cookie', aliceCookie).send({ body: 'Too soon' })).status, 403);

  const connection = await request(app).post('/api/connections/bob_safe/request').set('Cookie', aliceCookie);
  assert.equal(connection.status, 201);
  assert.equal((await request(app).post(`/api/connections/${connection.body.id}/respond`).set('Cookie', bobCookie).send({ action: 'accept' })).status, 200);

  const sent = await request(app).post('/api/messages/bob_safe').set('Cookie', aliceCookie).send({ body: 'A private hello' });
  assert.equal(sent.status, 201);
  const stored = await db.get('SELECT body FROM messages WHERE id = ?', sent.body.message.id);
  assert.match(stored.body, /^enc:v1:/);
  assert.equal(stored.body.includes('private hello'), false);
  const thread = await request(app).get('/api/messages/alice_safe').set('Cookie', bobCookie);
  assert.equal(thread.body.messages[0].body, 'A private hello');

  await request(app).post(`/api/blocks/${bob.body.user.id}`).set('Cookie', aliceCookie);
  assert.equal((await request(app).post('/api/messages/bob_safe').set('Cookie', aliceCookie).send({ body: 'Blocked' })).status, 403);
  assert.equal((await db.get('SELECT id FROM connections WHERE id = ?', connection.body.id)), null);
  const feed = await request(app).get('/api/posts').set('Cookie', aliceCookie);
  assert.equal(feed.body.posts.some((post) => post.username === 'bob_safe'), false);
  const search = await request(app).get('/api/search?q=bob_safe').set('Cookie', aliceCookie);
  assert.equal(search.body.users.length, 0);
});

test('exports member data and permanently deletes the account', async () => {
  const { app, db } = setup();
  const alice = await register(app, 'alice_delete', 'alice.delete@example.com');
  const cookie = alice.headers['set-cookie'];
  await request(app).post('/api/posts').set('Cookie', cookie).send({ body: 'My exportable story' });

  const exported = await request(app).get('/api/me/export').set('Cookie', cookie);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.account.email, 'alice.delete@example.com');
  assert.equal(exported.body.posts[0].body, 'My exportable story');
  assert.ok(exported.body.consents.length >= 6);

  const wrong = await request(app).delete('/api/me').set('Cookie', cookie).send({ password: 'wrong', confirmation: 'DELETE' });
  assert.equal(wrong.status, 401);
  const deleted = await request(app).delete('/api/me').set('Cookie', cookie).send({ password: 'Password123!', confirmation: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(await db.get('SELECT id FROM users WHERE email = ?', 'alice.delete@example.com'), null);
  assert.equal((await request(app).get('/api/me').set('Cookie', cookie)).status, 401);
});

test('supports authenticator-app two-factor login', async () => {
  const { app } = setup();
  const alice = await register(app, 'alice_mfa', 'alice.mfa@example.com');
  const cookie = alice.headers['set-cookie'];
  const setupResponse = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);
  assert.equal(setupResponse.status, 200);
  const code = totpCode(setupResponse.body.secret);
  const confirmed = await request(app).post('/api/auth/2fa/confirm').set('Cookie', cookie).send({ code });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.user.two_factor_enabled, true);
  const resetAttempt = await request(app).post('/api/auth/2fa/setup').set('Cookie', cookie);
  assert.equal(resetAttempt.status, 409);

  const pending = await request(app).post('/api/auth/login').send({ email: 'alice.mfa@example.com', password: 'Password123!' });
  assert.equal(pending.status, 202);
  assert.equal(pending.body.mfa_required, true);
  const login = await request(app).post('/api/auth/login').send({ email: 'alice.mfa@example.com', password: 'Password123!', mfa_code: totpCode(setupResponse.body.secret) });
  assert.equal(login.status, 200);
});

test('uses configured production admins and gates unverified member actions', async () => {
  const db = createDatabase('sqlite::memory:');
  createTables(db);
  const config = {
    ...getRuntimeConfig({ NODE_ENV: 'test', ADMIN_EMAILS: 'owner@mysazz.com', BOOTSTRAP_FIRST_USER_ADMIN: 'false' }),
    requireEmailVerification: true
  };
  const app = createApp({ db, config });
  const first = await request(app).post('/api/auth/register').send(registrationPayload('first_member', 'first@example.com'));
  assert.equal(first.body.user.is_admin, false);
  assert.equal((await request(app).post('/api/posts').set('Cookie', first.headers['set-cookie']).send({ body: 'Before verification' })).status, 403);
  await request(app).post('/api/auth/email-verification/confirm').send({ token: first.body.verification.dev_token });
  assert.equal((await request(app).post('/api/posts').set('Cookie', first.headers['set-cookie']).send({ body: 'After verification' })).status, 201);

  const owner = await request(app).post('/api/auth/register').send(registrationPayload('owner', 'owner@mysazz.com'));
  assert.equal(owner.body.user.is_admin, true);
});
