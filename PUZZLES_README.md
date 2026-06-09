# Adding Puzzles to Backrank Chess

## What Changed

Your game now supports loading puzzles from external sources without breaking
anything. The original 36 hand-crafted puzzles are preserved, and new puzzles
are merged in automatically.

### Current Puzzle Count

| Difficulty | Original | Starter | Total |
|------------|----------|---------|-------|
| Easy       | 12       | 25      | 37    |
| Medium     | 12       | 25      | 37    |
| Hard       | 12       | 25      | 37    |

The starter puzzles come from `puzzles_starter.js` (75 tactical positions).

## How It Works

When the game loads, `data.js` automatically merges puzzle databases:

1. **Original puzzles** (`PUZZLE_DB` in `data.js`) - always loaded
2. **Starter puzzles** (`puzzles_starter.js`) - loaded if present
3. **Lichess puzzles** (`puzzles_lichess.js`) - loaded if present

Duplicate puzzles (same FEN) are automatically skipped.

## Adding Thousands More Puzzles (Lichess)

Lichess has **6+ million open-source puzzles** available for free. Use the
included converter to download and convert them.

### Quick Start

1. Make sure you have Python installed:
   ```bash
   pip install python-chess requests zstandard
   ```

2. Run the converter:
   ```bash
   python convert_lichess_puzzles.py
   ```

3. Copy the output to your game folder:
   ```bash
   cp puzzles_lichess.js /path/to/your/game/
   ```

4. Add to `index.html` (before `data.js`):
   ```html
   <script src="puzzles_lichess.js"></script>
   <script src="data.js"></script>
   ```

That's it! The puzzles merge automatically on load.

### Customizing the Download

Edit `convert_lichess_puzzles.py` to change these settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `TARGET_COUNTS.easy` | 1500 | Puzzles with rating < 1200 |
| `TARGET_COUNTS.medium` | 1500 | Puzzles with rating 1200-1800 |
| `TARGET_COUNTS.hard` | 1000 | Puzzles with rating > 1800 |
| `DOWNLOAD_MB` | 50 | Compressed data to download |

Increase `DOWNLOAD_MB` for more puzzles:
- `20` MB ~ 50,000 puzzles
- `50` MB ~ 150,000 puzzles
- `100` MB ~ 300,000 puzzles
- `0` or `None` = entire database (400MB, slow!)

## Adding Your Own Puzzles

You can create a puzzle file with any name. Follow this format:

```javascript
var MY_PUZZLES = {
  easy: [
    {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      moves: ["e7e5"],
      theme: "Open Game",
      rating: 400
    }
  ],
  medium: [ /* ... */ ],
  hard: [ /* ... */ ]
};
```

Then add the merge code to `data.js` inside the `mergePuzzleDatabases` function:

```javascript
{ name: 'MY_PUZZLES', obj: typeof MY_PUZZLES !== 'undefined' ? MY_PUZZLES : null },
```

And include your script in `index.html` before `data.js`.

## File Overview

| File | Purpose |
|------|---------|
| `convert_lichess_puzzles.py` | Downloads Lichess puzzles and converts to game format |
| `generate_starter_puzzles.py` | Generates the 75 starter puzzles (already done) |
| `puzzles_starter.js` | 75 pre-generated tactical puzzles |
| `puzzles_lichess.js` | Output from converter (create by running script) |

## Puzzle Format

Both original and external puzzles use the same format:

```javascript
{
  fen: "position FEN string",
  moves: ["e2e4", "e7e5", "g1f3"],  // UCI format
  theme: "Descriptive Name",
  rating: 1200  // ELO estimate
}
```

Moves are in **UCI format** (e.g., `e2e4`, not algebraic notation).
The first move is the player's correct move.
