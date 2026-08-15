// @ts-nocheck
import { createDatabase } from '../src/lib/database';
import { createTables } from '../src/db';
import { createApp } from '../src/app';

/** Creates an in-memory SQLite test app with a fresh schema. */
export function setup() {
  const db = createDatabase('sqlite::memory:');
  createTables(db);
  const app = createApp({ db, jwtSecret: 'test-secret' });
  return { app, db };
}

export function registrationPayload(username, email, password = 'Password123!') {
  return {
    username,
    email,
    password,
    relationship_status: 'prefer_not_to_say',
    connection_intents: ['friendship', 'peer_support'],
    experience_tags: [],
    city: '',
    region: '',
    age_18_plus: true,
    recovery_one_year: true,
    member_confidentiality: true,
    terms_accepted: true,
    privacy_accepted: true,
    not_medical_care: true
  };
}

/** Registers a user via the API and returns the supertest response. */
export async function register(app, username, email, password = 'Password123!') {
  const { default: request } = await import('supertest');
  return request(app).post('/api/auth/register').send(registrationPayload(username, email, password));
}
