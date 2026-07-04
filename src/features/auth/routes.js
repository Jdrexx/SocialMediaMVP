import bcrypt from 'bcryptjs';
import express from 'express';
import { createToken, publicUser, setAuthCookie, signToken } from '../../lib/auth.js';
import { authRequired } from '../../lib/http.js';
import { emailSchema, loginSchema, registerSchema, resetConfirmSchema, tokenSchema } from '../../lib/schemas.js';

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
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, userEmail);
    if (existing) return res.status(409).json({ error: 'Username or email is already taken' });

    const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(username, userEmail, passwordHash, userCount === 0 ? 1 : 0);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    const verifyToken = createToken();
    db.prepare('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)').run(user.id, 'email_verify', verifyToken, futureDate(24 * 60));
    const sendResult = await email.sendEmailVerification(user, verifyToken);

    setAuthCookie(res, signToken(user, jwtSecret), { secure: config.cookieSecure });
    res.status(201).json({ user: publicUser(user), verification: emailResponse(sendResult, verifyToken) });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email);
    if (!user || user.is_suspended || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    setAuthCookie(res, signToken(user, jwtSecret), { secure: config.cookieSecure });
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.post('/password-reset/request', async (req, res) => {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email);
    if (!user) return res.json({ ok: true });

    const token = createToken();
    db.prepare('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)').run(user.id, 'password_reset', token, futureDate(60));
    const sendResult = await email.sendPasswordReset(user, token);
    res.json(emailResponse(sendResult, token));
  });

  router.post('/password-reset/confirm', async (req, res) => {
    const parsed = resetConfirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const token = db.prepare('SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND used_at IS NULL').get(parsed.data.token, 'password_reset');
    if (!token || new Date(token.expires_at) < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, token.user_id);
    db.prepare('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(token.id);
    res.json({ ok: true });
  });

  router.post('/email-verification/request', authRequired, async (req, res) => {
    const token = createToken();
    db.prepare('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)').run(req.user.id, 'email_verify', token, futureDate(24 * 60));
    const sendResult = await email.sendEmailVerification(req.user, token);
    res.json(emailResponse(sendResult, token));
  });

  router.post('/email-verification/confirm', (req, res) => {
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const token = db.prepare('SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND used_at IS NULL').get(parsed.data.token, 'email_verify');
    if (!token || new Date(token.expires_at) < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });

    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(token.user_id);
    db.prepare('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(token.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(token.user_id);
    res.json({ ok: true, user: publicUser(user) });
  });

  router.get('/session', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

  // ── Change password (authenticated) ──

  router.post('/change-password', authRequired, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    res.json({ ok: true });
  });

  return router;
}
