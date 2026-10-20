const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { signToken, wrap, HttpError } = require('../middleware');
const { RULES, publicUser, str, addPoints } = require('./helpers');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' } });

router.post('/register', authLimiter, wrap((req, res) => {
  const name = str(req.body.name, 80);
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (name.length < 2) throw new HttpError(400, 'Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 8) throw new HttpError(400, 'Use a password of at least 8 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');

  const id = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10)).lastInsertRowid;
  db.transaction(() => addPoints(id, RULES.WELCOME_BONUS, 'Welcome bonus', 'signup'))();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', authLimiter, wrap((req, res) => {
  const email = str(req.body.email, 120).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    throw new HttpError(401, 'That email and password don’t match an account.');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

module.exports = router;
