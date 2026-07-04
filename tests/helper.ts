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

/** Registers a user via the API and returns the supertest response. */
export async function register(app, username, email, password = 'Password123!') {
  const { default: request } = await import('supertest');
  return request(app).post('/api/auth/register').send({ username, email, password });
}
