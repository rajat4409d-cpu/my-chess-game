const express = require('express');
const requireAuth = require('../middleware/auth');
const Game = require('../models/Game');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const games = await Game.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  res.json({
    user: req.user.toPublic(),
    sessionStats: req.user.sessionStats || {},
    puzzleStats: req.user.puzzleStats || {},
    settings: req.user.settings || {},
    games: games.map((g) => ({
      id: g._id.toString(),
      result: g.result,
      opponent: g.opponent,
      moveCount: g.moveCount,
      endedBy: g.endedBy,
      createdAt: g.createdAt
    }))
  });
});

router.put('/stats', requireAuth, async (req, res) => {
  req.user.sessionStats = req.body.sessionStats || req.user.sessionStats || {};
  req.user.puzzleStats = req.body.puzzleStats || req.user.puzzleStats || {};
  if (req.body.settings) req.user.settings = req.body.settings;
  await req.user.save();
  res.json({ ok: true });
});

module.exports = router;
