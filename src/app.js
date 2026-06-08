import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { registerFeatures } from './features/index.js';
import { getUserFromReq } from './lib/auth.js';
import { notFound } from './lib/http.js';

export function createApp({ db, jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me' }) {
  const app = express();
  const context = { db, jwtSecret };

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static('public'));
  app.use(cookieParser());
  app.use(morgan('dev'));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
  app.use((req, _res, next) => {
    req.user = getUserFromReq(req, db, jwtSecret);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, features: ['auth', 'uploads', 'users', 'posts', 'notifications', 'search', 'moderation', 'messages'] }));
  registerFeatures(app, context);
  app.use('/api/*', notFound);

  return app;
}
