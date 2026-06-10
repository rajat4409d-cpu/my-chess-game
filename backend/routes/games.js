const express = require('express');
const requireAuth = require('../middleware/auth');
const Game = require('../models/Game');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const game = await Game.create({
      user: req.user._id,
      result: String(req.body.result || 'unknown').slice(0, 30),
      opponent: String(req.body.opponent || '').slice(0, 80),
      moveCount: Number(req.body.moveCount || 0),
      endedBy: String(req.body.endedBy || req.body.by || '').slice(0, 80),
      pgn: String(req.body.pgn || '').slice(0, 30000)
    });

    res.status(201).json({ id: game._id.toString() });
  } catch (err) {
    console.error('[create game]', err);
    res.status(500).json({ error: 'Could not save game.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const games = await Game.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    games: games.map((g) => ({
      id: g._id.toString(),
      result: g.result,
      opponent: g.opponent,
      moveCount: g.moveCount,
      endedBy: g.endedBy,
      pgn: g.pgn,
      createdAt: g.createdAt
    }))
  });
});

module.exports = router;
