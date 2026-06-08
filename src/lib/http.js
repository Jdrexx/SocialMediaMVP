export function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
