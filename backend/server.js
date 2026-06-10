require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const gameRoutes = require('./routes/games');

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

if (!JWT_SECRET || JWT_SECRET === 'change-this-to-a-long-random-secret-before-deploying') {
  console.warn('Warning: set a strong JWT_SECRET before deploying publicly.');
}

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = CLIENT_ORIGIN === '*'
  ? '*'
  : CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins === '*' ? true : allowedOrigins,
  credentials: false
}));

app.get('/', (_req, res) => {
  res.json({ ok: true, app: 'Backrank Chess API', db: 'MongoDB' });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Backrank Chess API', db: 'MongoDB' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/games', gameRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Backrank Chess API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
