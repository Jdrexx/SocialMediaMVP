// @ts-nocheck
import bcrypt from 'bcryptjs';
import express from 'express';
import { createToken, hashToken, ownUser, publicUser, setAuthCookie, signToken } from '../../lib/auth';
import { authRequired } from '../../lib/http';
import { changePasswordSchema, emailSchema, loginSchema, registerSchema, resetConfirmSchema, tokenSchema } from '../../lib/schemas';
import { checkLoginRate, recordLoginAttempt } from '../../lib/http';

function futureDate(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function emailResponse(sendResult, token) {
  if (sendResult.sent) return { ok: true, email_sent: true };
  return { ok: true, email_sent: false, dev_token: token, message: sendResult.reason };
}

export function createAuthRouter({ db, jwtSecret, config, email }) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { username, email: userEmail, password } = parsed.data;
    const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', username, userEmail);
    if (existing) return res.status(409).json({ error: 'Username or email is already taken' });

    const userCount = await db.get('SELECT COUNT(*) AS c FROM users').c;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.run('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)', username, userEmail, passwordHash, userCount === 0 ? 1 : 0);
    const user = await db.get('SELECT * FROM users WHERE id = ?', result.lastInsertRowid);

    const verifyToken = createToken();
    const verifyTokenHash = hashToken(verifyToken);
    db.run('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)', user.id, 'email_verify', verifyTokenHash, futureDate(24 * 60));
    const sendResult = await email.sendEmailVerification(user, verifyToken);

    setAuthCookie(res, signToken(user, jwtSecret), { secure: config.cookieSecure });
    res.status(201).json({ user: ownUser(user), verification: emailResponse(sendResult, verifyToken) });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    // Rate-limit check per email
    const rateCheck = checkLoginRate(parsed.data.email);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: `Too many login attempts. Try again in ${rateCheck.retryAfter} minutes.` });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', parsed.data.email);
    if (!user || user.is_suspended || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      recordLoginAttempt(parsed.data.email, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    recordLoginAttempt(parsed.data.email, true);
    setAuthCookie(res, signToken(user, jwtSecret), { secure: config.cookieSecure });
    res.json({ user: ownUser(user) });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.post('/password-reset/request', async (req, res) => {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const user = await db.get('SELECT * FROM users WHERE email = ?', parsed.data.email);
    if (!user) return res.json({ ok: true });

    const token = createToken();
    const tokenHash = hashToken(token);
    db.run('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)', user.id, 'password_reset', tokenHash, futureDate(60));
    const sendResult = await email.sendPasswordReset(user, token);
    res.json(emailResponse(sendResult, token));
  });

  router.post('/password-reset/confirm', async (req, res) => {
    const parsed = resetConfirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const tokenHash = hashToken(parsed.data.token);
    const token = await db.get('SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND used_at IS NULL', tokenHash, 'password_reset');
    if (!token || new Date(token.expires_at) < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, token.user_id);
    await db.run('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', token.id);
    res.json({ ok: true });
  });

  router.post('/email-verification/request', authRequired, async (req, res) => {
    const token = createToken();
    const tokenHash = hashToken(token);
    db.run('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)', req.user.id, 'email_verify', tokenHash, futureDate(24 * 60));
    const sendResult = await email.sendEmailVerification(req.user, token);
    res.json(emailResponse(sendResult, token));
  });

  router.post('/email-verification/confirm', async (req, res) => {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const tokenHash = hashToken(parsed.data.token);
    const token = await db.get('SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND used_at IS NULL', tokenHash, 'email_verify');
    if (!token || new Date(token.expires_at) < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });

    await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', token.user_id);
    await db.run('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', token.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', token.user_id);
    res.json({ ok: true, user: ownUser(user) });
  });

  router.get('/session', authRequired, (req, res) => res.json({ user: ownUser(req.user) }));

  // ── Change password (authenticated) ──

  router.post('/change-password', authRequired, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { current_password, new_password } = parsed.data;
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, user.id);
    res.json({ ok: true });
  });

  return router;
}
