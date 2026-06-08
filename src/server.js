import http from 'node:http';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { getRuntimeConfig } from './lib/env.js';
import { attachRealtimeServer } from './lib/realtime.js';

const config = getRuntimeConfig();
const db = createDatabase(config.dbFile);
const app = createApp({ db, config });
const server = http.createServer(app);
const io = attachRealtimeServer(server, { db, jwtSecret: config.jwtSecret });
app.locals.context.io = io;

server.listen(config.port, () => {
  console.log(`Social media MVP running at http://localhost:${config.port}`);
  console.log(`Email sending: ${app.locals.context.email.enabled ? 'configured' : 'dev-token fallback'}`);
});
