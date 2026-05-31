# ♔ Premium Web Chess Engine

A fully responsive, feature-rich web-based chess application built from scratch. It features a modern, minimalist UI, local 2-player capabilities, a Web Worker-powered Grandmaster AI, a full post-game analysis suite, a dedicated puzzle trainer, and a complete light/dark theme system.

## ✨ Features

### 🎮 Gameplay

- **Stockfish 10 Integration:** Play against a world-class AI with adjustable difficulty levels (Beginner, Advanced, Grandmaster). The engine runs in a background Web Worker for zero-latency gameplay.
- **Live Evaluation Bar:** Real-time centipawn/mate evaluation tracking, dynamically updating after every move.
- **Dynamic Game Modes:** Seamlessly toggle between Player vs. Engine (PvE) and Player vs. Player (PvP) modes.
- **Chess Clock:** Configurable time controls (1, 3, 5, 10 minutes) with active timer highlighting and timeout detection.
- **Match Data & UI:** Live move history in algebraic notation alongside a material graveyard tracking captured pieces and score advantages.
- **Opening Tracker:** Automatically identifies and displays the opening name (e.g. Italian Game, Sicilian Defense) as moves are played.
- **Customization:** 5 board themes (Wood, Mint Green, Lichess Blue, Monochrome, Coral) and 3 piece styles, with a working Flip Board mechanic.
- **Professional Polish:** Legal move dot overlays, capture rings, premium Lichess audio cues, custom pawn promotion menus, and checkmate confetti.
- **PGN Export:** Download completed games as standard `.pgn` files.

### 🧩 Puzzle Trainer

- **Tactical Puzzle Mode:** Solve curated chess puzzles across three difficulty tiers — Easy, Medium, and Hard.
- **Interactive Hint System:** Stuck on a puzzle? Use the Hint button to highlight the correct piece or reveal an arrow pointing to the key square.
- **Instant Feedback:** Correct moves are highlighted in green; wrong moves trigger a shake animation and reveal the solution.
- **Solution Walkthrough:** After solving or failing, view the full correct move sequence with clear player/opponent labeling.
- **Session Tracking:** Real-time puzzle stats including attempted, solved, failed, current streak, and best streak.
- **Adaptive Difficulty:** Switch between Easy (≈500), Medium (≈1200), and Hard (≈1800) rated puzzles on the fly.

### 📊 Game Analysis

- **Full Stockfish Analysis:** Every position in the game is evaluated at depth 18 using a dedicated background engine worker.
- **Move Annotations:** Each move is automatically rated:
  - ★ **Brilliant** — Engine's top move in a non-trivial position
  - ✓ **Best** — Excellent move (≤20cp loss)
  - **?!** Inaccuracy (≤60cp loss)
  - **?** Mistake (≤200cp loss)
  - **??** Blunder (&gt;200cp loss)
- **Best Move Arrow:** A green SVG arrow overlaid on the board shows the engine's recommended move for every position, just like Chess.com.
- **Annotation Badge:** A colored icon appears on the destination square of each played move indicating its rating.
- **Perspective Mode:** Before analysis begins, choose to analyze from White's perspective, Black's perspective, or both — counts and badges only apply to the selected player's moves.
- **PGN Import:** Load any game for analysis by pasting PGN text or uploading a `.pgn` / `.txt` file via drag-and-drop or file browser.
- **Step-Through Navigation:** Browse positions move by move using buttons or arrow keys, with the board updating in real time.
- **Live Progress:** A loading banner shows analysis progress position by position, with annotations updating live as each position finishes.

### 🏠 Player Profile (Home)

- **Session Stats:** Tracks games played, wins, losses, draws, and current win streak for the session.
- **Win Rate Bar:** A segmented bar visualizing your win/draw/loss split as percentages.
- **Recent Games History:** Every completed game is logged with result, opponent, how it ended (checkmate, resignation, timeout, draw), move count, and timestamp.
- **Achievements:** 11 unlockable achievements tracked across the session — First Move, Winner, Hat Trick, Veteran, Checkmate King, Never Give Up, Dominator, Analyst, Puzzle Starter, Puzzle Master, and On Fire.

### 🌗 UI & Theming

- **Light / Dark Mode:** Full light and dark themes with smooth CSS transitions across every component. Automatically respects system preference on first load and persists the user's choice in `localStorage`.
- **Theme Toggle:** One-click toggle accessible from the desktop sidebar, mobile top bar, and mobile navigation drawer.
- **Fully Responsive:** Optimized layout from desktop (3-column grid) down to tablets and phones. Mobile features include:
  - Hamburger slide-out navigation menu
  - Collapsible right-side match data panel
  - Touch-optimized tap targets and button sizing
  - Orientation-aware board resizing
- **Modern Modals:** Redesigned settings, promotion, perspective picker, and PGN import modals with backdrop blur and consistent spacing.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (CSS Grid/Flexbox), JavaScript (ES6)
- **Libraries:** Chess.js (game logic), Chessboard.js (board UI), jQuery, canvas-confetti
- **Engine:** Stockfish.js (dual Web Worker integration — one for live play, one for analysis)

## 🚀 How to Run Locally

1. Clone this repository to your local machine.
2. Open the project folder in VS Code.
3. Launch `index.html` using the **Live Server** extension to bypass cross-origin browser restrictions.