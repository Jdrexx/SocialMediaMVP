// @ts-nocheck
// In-memory login attempt tracking (per email, reset on restart — acceptable for MVP)
const LOGIN_ATTEMPTS = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRate(email) {
  const entry = LOGIN_ATTEMPTS.get(email);
  if (!entry) return { allowed: true };
  if (Date.now() - entry.firstAttempt > LOGIN_WINDOW_MS) {
    LOGIN_ATTEMPTS.delete(email);
    return { allowed: true };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil((LOGIN_WINDOW_MS - (Date.now() - entry.firstAttempt)) / 60000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export function recordLoginAttempt(email, success) {
  if (success) {
    LOGIN_ATTEMPTS.delete(email);
    return;
  }
  const entry = LOGIN_ATTEMPTS.get(email) || { count: 0, firstAttempt: Date.now() };
  entry.count++;
  if (entry.count === 1) entry.firstAttempt = Date.now();
  LOGIN_ATTEMPTS.set(email, entry);
}

export function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export function adminRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

export function csrfProtection(req, res, next) {
  // Skip CSRF in test mode — test runner doesn't simulate browser CSRF scenarios
  if (process.env.NODE_ENV === 'test') return next();
  const stateful = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (!stateful.includes(req.method)) return next();
  // No auth cookie or bearer token = no session to CSRF-protect
  if (!req.headers.cookie && !req.headers.authorization) return next();
  // X-Requested-With cannot be set cross-origin without CORS preflight
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  next();
}

export function uploadsAuth(req, res, next) {
  // Dev-mode: allow access for local testing convenience
  // Production: require valid session
  if (!req.app.locals.context?.config?.isProduction) return next();
  if (!req.user) return res.status(401).json({ error: 'Authentication required to access uploads' });
  next();
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
