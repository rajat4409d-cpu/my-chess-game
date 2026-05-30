# ♔ Premium Web Chess Engine

A fully responsive, feature-rich web-based chess application built from scratch. It features a modern, minimalist UI, local 2-player capabilities, and a Web Worker-powered Grandmaster AI.

## ✨ Current Features
* **Stockfish 10 Integration:** Play against a world-class AI with adjustable difficulty levels (Beginner to Grandmaster). The engine runs in a background Web Worker for zero-latency gameplay.
* **Live Evaluation Bar:** Real-time mathematical advantage tracking, dynamically updating based on Stockfish's centipawn/mate evaluations.
* **Dynamic Game Modes:** Seamlessly toggle between Player vs. Engine (PvE) and Player vs. Player (PvP) modes.
* **Match Data & UI:** Live move history with algebraic notation, alongside a material "Graveyard" tracking captured pieces and score advantages.
* **Customization:** Choose between 5 different board themes (Wood, Mint Green, Lichess Blue, etc.) and 3 piece styles, complete with a working "Flip Board" mechanic.
* **Professional Polish:** Features legal move dot overlays, capture rings, premium audio cues from Lichess, custom pawn promotion menus, and checkmate confetti.
* **PGN Match Export:** Instantly download your completed games as standard `.pgn` files for external analysis.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3 (CSS Grid/Flexbox for mobile responsiveness), JavaScript (ES6)
* **Libraries:** Chess.js (game logic), Chessboard.js (board UI), jQuery
* **Engine:** Stockfish.js (Web Worker integration)

## 🚀 How to Run Locally
1. Clone this repository to your local machine.
2. Open the project folder in VS Code.
3. Launch `index.html` using the **Live Server** extension to bypass cross-origin browser restrictions.