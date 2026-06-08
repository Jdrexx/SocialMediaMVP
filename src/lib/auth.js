import jwt from 'jsonwebtoken';

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatar_url: user.avatar_url,
    created_at: user.created_at
  };
}

export function signToken(user, secret) {
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function getUserFromReq(req, db, jwtSecret) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub));
  } catch {
    return null;
  }
}
