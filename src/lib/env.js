import crypto from 'node:crypto';

const WEAK_SECRETS = new Set(['dev-secret-change-me', 'test-secret', 'secret', 'change-me', 'password']);

export function getRuntimeConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const jwtSecret = env.JWT_SECRET || (isProduction ? '' : 'dev-secret-change-me');

  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32 || WEAK_SECRETS.has(jwtSecret)) {
      throw new Error('Production requires JWT_SECRET with at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    if (!env.DB_FILE && !env.DATABASE_URL) {
      throw new Error('Production requires DB_FILE pointing at a persistent volume, or DATABASE_URL for a managed production database migration.');
    }
  }

  return {
    nodeEnv,
    isProduction,
    port: Number(env.PORT || 3000),
    dbFile: env.DB_FILE || 'social.sqlite',
    databaseUrl: env.DATABASE_URL || '',
    jwtSecret,
    publicUrl: env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`,
    cookieSecure: isProduction || env.COOKIE_SECURE === 'true',
    smtp: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || 'Social Media MVP <no-reply@example.com>'
    },
    sessionId: crypto.randomUUID()
  };
}

export function hasSmtpConfig(config) {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}
