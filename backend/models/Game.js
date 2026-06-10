const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    result: {
      type: String,
      required: true,
      enum: ['win', 'loss', 'draw', 'resign', 'unknown']
    },
    opponent: {
      type: String,
      default: ''
    },
    moveCount: {
      type: Number,
      default: 0
    },
    endedBy: {
      type: String,
      default: ''
    },
    pgn: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
