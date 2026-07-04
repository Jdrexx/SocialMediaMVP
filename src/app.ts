// @ts-nocheck
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { registerFeatures } from './features/index';
import { getUserFromReq } from './lib/auth';
import { createEmailService } from './lib/email';
import { getRuntimeConfig } from './lib/env';
import { csrfProtection, notFound, uploadsAuth } from './lib/http';

export function createApp({ db, jwtSecret, config }: any = {}) {
  const runtimeConfig = config || getRuntimeConfig();
  const secret = jwtSecret || runtimeConfig.jwtSecret;
  const email = createEmailService(runtimeConfig);
  const app = express();
  const context: any = { db, jwtSecret: secret, config: runtimeConfig, email, io: null };

  app.locals.context = context;
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"]
      }
    }
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static('public', { index: false }));
  app.use(cookieParser());
  app.use(morgan(runtimeConfig.isProduction ? 'combined' : 'dev'));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: runtimeConfig.isProduction ? 30 : 100, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: runtimeConfig.isProduction ? 120 : 300, standardHeaders: true, legacyHeaders: false }));
  // CSRF protection for all API state-changing requests
  app.use('/api', csrfProtection);
  // Auth gate for uploads (production only — dev mode allows access)
  app.use('/uploads', uploadsAuth);
  app.use((req, _res, next) => {
    Promise.resolve(getUserFromReq(req, db, secret))
      .then(user => { req.user = user; next(); })
      .catch(next);
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
