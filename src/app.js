import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { registerFeatures } from './features/index.js';
import { getUserFromReq } from './lib/auth.js';
import { createEmailService } from './lib/email.js';
import { getRuntimeConfig } from './lib/env.js';
import { notFound } from './lib/http.js';

export function createApp({ db, jwtSecret, config } = {}) {
  const runtimeConfig = config || getRuntimeConfig();
  const secret = jwtSecret || runtimeConfig.jwtSecret;
  const email = createEmailService(runtimeConfig);
  const app = express();
  const context = { db, jwtSecret: secret, config: runtimeConfig, email, io: null };

  app.locals.context = context;
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static('public', { index: false }));
  app.use(cookieParser());
  app.use(morgan(runtimeConfig.isProduction ? 'combined' : 'dev'));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: runtimeConfig.isProduction ? 30 : 100, standardHeaders: true, legacyHeaders: false }));
  app.use((req, _res, next) => {
    req.user = getUserFromReq(req, db, secret);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({
    ok: true,
    features: ['auth', 'uploads', 'users', 'posts', 'notifications', 'search', 'moderation', 'messages'],
    email: { configured: email.enabled },
    realtime: { transport: 'socket.io', capabilities: ['messages', 'typing', 'video-call-signaling'] },
    production: runtimeConfig.isProduction
  }));
  registerFeatures(app, context);
  app.use('/api/*', notFound);

  return app;
}
