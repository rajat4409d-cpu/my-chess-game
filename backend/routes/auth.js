const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please try again later.' }
});

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '14d' }
  );
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and use only letters, numbers, or underscore.' });
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingQuery = email
      ? { $or: [{ username }, { email }] }
      : { username };

    const existing = await User.findOne(existingQuery);
    if (existing) {
      return res.status(409).json({ error: 'That username or email is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email: email || undefined,
      passwordHash,
      sessionStats: req.body.sessionStats || undefined,
      puzzleStats: req.body.puzzleStats || undefined
    });

    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const login = String(req.body.login || req.body.username || '').trim();
    const password = String(req.body.password || '');

    const user = await User.findOne({
      $or: [{ username: login }, { email: login.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
