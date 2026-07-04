// @ts-nocheck
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    bio: user.bio,
    avatar_url: user.avatar_url,
    cover_url: user.cover_url,
    email_verified: Boolean(user.email_verified),
    is_admin: Boolean(user.is_admin),
    is_suspended: Boolean(user.is_suspended),
    created_at: user.created_at
  };
}

export function adminUser(user) {
  if (!user) return null;
  return { ...publicUser(user), email: user.email };
}

export function ownUser(user) {
  if (!user) return null;
  return { ...publicUser(user), email: user.email };
}

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signToken(user, secret) {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, { expiresIn: '7d', issuer: 'social-media-mvp' });
}

export function setAuthCookie(res, token, { secure = false } = {}) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function getTokenFromCookieHeader(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('token='))
    ?.slice('token='.length);
}

export async function getUserFromToken(token, db, jwtSecret) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret, { issuer: 'social-media-mvp' });
    return await db.get('SELECT * FROM users WHERE id = ?', Number(payload.sub));
  } catch {
    return null;
  }
}

export async function getUserFromCookieHeader(cookieHeader, db, jwtSecret) {
  return getUserFromToken(getTokenFromCookieHeader(cookieHeader), db, jwtSecret);
}

export async function getUserFromReq(req, db, jwtSecret) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return await getUserFromToken(token, db, jwtSecret);
}
