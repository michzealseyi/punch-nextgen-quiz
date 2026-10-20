const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

const bearer = (req) => {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};
const findUser = (id) => db.prepare('SELECT id,name,email,role,points,lifetime_points FROM users WHERE id=?').get(id);

function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const user = findUser(jwt.verify(token, JWT_SECRET).sub);
    if (!user) return res.status(401).json({ error: 'Your account no longer exists.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

// For public routes that personalise their response when a valid token is present
function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (token) {
    try { req.user = findUser(jwt.verify(token, JWT_SECRET).sub); } catch { /* treat as signed out */ }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

// Wrap sync/async handlers so thrown errors reach the error middleware
const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// The calendar day in West Africa Time (UTC+1, no DST)
function watDay(ms = Date.now()) {
  return new Date(ms + 60 * 60 * 1000).toISOString().slice(0, 10);
}
function watDayBounds(ms = Date.now()) {
  const day = watDay(ms);
  const start = Date.parse(day + 'T00:00:00Z') - 60 * 60 * 1000;
  return [start, start + 24 * 60 * 60 * 1000];
}

module.exports = { signToken, requireAuth, optionalAuth, requireAdmin, wrap, HttpError, watDay, watDayBounds };
