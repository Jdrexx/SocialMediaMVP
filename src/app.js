import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const postSchema = z.object({ body: z.string().trim().min(1).max(500), image_url: z.string().trim().url().optional().or(z.literal('')) });
const commentSchema = z.object({ body: z.string().trim().min(1).max(240) });
const profileSchema = z.object({ bio: z.string().trim().max(240).optional(), avatar_url: z.string().trim().url().optional().or(z.literal('')) });

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, bio: user.bio, avatar_url: user.avatar_url, created_at: user.created_at };
}

function signToken(user, secret) {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, { expiresIn: '7d' });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function getUserFromReq(req, db, jwtSecret) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub));
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function serializePost(row, db, viewerId) {
  const comments = db.prepare(`
    SELECT comments.*, users.username, users.avatar_url
    FROM comments JOIN users ON users.id = comments.user_id
    WHERE comments.post_id = ?
    ORDER BY comments.created_at ASC
    LIMIT 20
  `).all(row.id);
  return {
    ...row,
    liked_by_me: Boolean(row.liked_by_me),
    comments
  };
}

function getPosts(db, viewerId, whereSql = '', params = []) {
  const rows = db.prepare(`
    SELECT posts.*, users.username, users.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes WHERE likes.post_id = posts.id AND likes.user_id = ?) AS liked_by_me
    FROM posts JOIN users ON users.id = posts.user_id
    ${whereSql}
    ORDER BY posts.created_at DESC, posts.id DESC
    LIMIT 50
  `).all(viewerId ?? 0, ...params);
  return rows.map((row) => serializePost(row, db, viewerId));
}

export function createApp({ db, jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me' }) {
  const app = express();
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

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { username, email, password } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email is already taken' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    setAuthCookie(res, signToken(user, jwtSecret));
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email);
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
    setAuthCookie(res, signToken(user, jwtSecret));
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  app.get('/api/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

  app.patch('/api/me', authRequired, (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const bio = parsed.data.bio ?? req.user.bio;
    const avatarUrl = parsed.data.avatar_url ?? req.user.avatar_url;
    db.prepare('UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?').run(bio, avatarUrl, req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(user) });
  });

  app.get('/api/users/:username', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const follower_count = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?').get(user.id).c;
    const following_count = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?').get(user.id).c;
    const following = req.user ? Boolean(db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, user.id)) : false;
    res.json({ user: { ...publicUser(user), follower_count, following_count, following }, posts: getPosts(db, req.user?.id, 'WHERE posts.user_id = ?', [user.id]) });
  });

  app.post('/api/users/:username/follow', authRequired, (req, res) => {
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
    const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, target.id);
    if (existing) {
      db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, target.id);
      return res.json({ following: false });
    }
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, target.id);
    res.json({ following: true });
  });

  app.get('/api/feed', authRequired, (req, res) => {
    const posts = getPosts(db, req.user.id, `WHERE posts.user_id = ? OR posts.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)`, [req.user.id, req.user.id]);
    res.json({ posts });
  });

  app.get('/api/posts', (req, res) => res.json({ posts: getPosts(db, req.user?.id) }));

  app.post('/api/posts', authRequired, (req, res) => {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const result = db.prepare('INSERT INTO posts (user_id, body, image_url) VALUES (?, ?, ?)').run(req.user.id, parsed.data.body, parsed.data.image_url || '');
    const post = getPosts(db, req.user.id, 'WHERE posts.id = ?', [result.lastInsertRowid])[0];
    res.status(201).json({ post });
  });

  app.delete('/api/posts/:id', authRequired, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/posts/:id/like', authRequired, (req, res) => {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
    if (existing) {
      db.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').run(req.user.id, post.id);
      return res.json({ liked: false });
    }
    db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').run(req.user.id, post.id);
    res.json({ liked: true });
  });

  app.post('/api/posts/:id/comments', authRequired, (req, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const result = db.prepare('INSERT INTO comments (user_id, post_id, body) VALUES (?, ?, ?)').run(req.user.id, post.id, parsed.data.body);
    const comment = db.prepare(`
      SELECT comments.*, users.username, users.avatar_url
      FROM comments JOIN users ON users.id = comments.user_id
      WHERE comments.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ comment });
  });

  app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}
