import bcrypt from 'bcryptjs';
import express from 'express';
import { createToken, publicUser, setAuthCookie, signToken } from '../../lib/auth.js';
import { authRequired } from '../../lib/http.js';
import { emailSchema, loginSchema, registerSchema, resetConfirmSchema, tokenSchema } from '../../lib/schemas.js';

function futureDate(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function createAuthRouter({ db, jwtSecret }) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { username, email, password } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email is already taken' });

    const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)').run(username, email, passwordHash, userCount === 0 ? 1 : 0);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    setAuthCookie(res, signToken(user, jwtSecret));
    res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email);
    if (!user || user.is_suspended || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    setAuthCookie(res, signToken(user, jwtSecret));
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.post('/password-reset/request', (req, res) => {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email);
    if (!user) return res.json({ ok: true });

    const token = createToken();
    db.prepare('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)').run(user.id, 'password_reset', token, futureDate(60));
    res.json({ ok: true, dev_token: token, message: 'MVP dev mode: send this token by email in production.' });
  });

  router.post('/password-reset/confirm', async (req, res) => {
    const parsed = resetConfirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const token = db.prepare('SELECT * FROM auth_tokens WHERE token = ? AND type = ? AND used_at IS NULL').get(parsed.data.token, 'password_reset');
    if (!token || new Date(token.expires_at) < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, token.user_id);
    db.prepare('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(token.id);
    res.json({ ok: true });
  });

  router.post('/email-verification/request', authRequired, (req, res) => {
    const token = createToken();
    db.prepare('INSERT INTO auth_tokens (user_id, type, token, expires_at) VALUES (?, ?, ?, ?)').run(req.user.id, 'email_verify', token, futureDate(24 * 60));
    res.json({ ok: true, dev_token: token, message: 'MVP dev mode: send this token by email in production.' });
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

  return router;
}
