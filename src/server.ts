// @ts-nocheck
import http from 'node:http';
import next from 'next';
import { createApp } from './app';
import { createTables } from './db';
import { createDatabase } from './lib/database';
import { getRuntimeConfig } from './lib/env';
import { attachRealtimeServer } from './lib/realtime';

const config = getRuntimeConfig();

// Create database — auto-detects SQLite vs PostgreSQL from connection string
const db = createDatabase(config.databaseUrl || config.dbFile);
createTables(db);

const app = createApp({ db, config });
const server = http.createServer(app);
const io = attachRealtimeServer(server, { db, jwtSecret: config.jwtSecret });
app.locals.context.io = io;

async function registerNextFrontend() {
  if (process.env.SERVE_NEXT === 'false') return;
  const nextApp = next({ dev: config.nodeEnv !== 'production' });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  app.all('*', (req, res) => handle(req, res));
}

await registerNextFrontend();

server.listen(config.port, () => {
  console.log(`Social media MVP running at http://localhost:${config.port}`);
  console.log(`Database: ${db._type === 'postgres' ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`Frontend: ${process.env.SERVE_NEXT === 'false' ? 'disabled' : 'Next.js served by Express'}`);
  console.log(`Email sending: ${app.locals.context.email.enabled ? 'configured' : 'dev-token fallback'}`);
});
