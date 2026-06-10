const mongoose = require('mongoose');

const defaultSessionStats = {
  played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  resignations: 0,
  checkmates: 0,
  analyzed: 0,
  gameHistory: []
};

const defaultPuzzleStats = {
  attempted: 0,
  solved: 0,
  failed: 0,
  streak: 0,
  bestStreak: 0
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    sessionStats: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultSessionStats })
    },
    puzzleStats: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultPuzzleStats })
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email || '',
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
