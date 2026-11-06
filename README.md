A JavaScript-based Connect Four engine built around Minimax search, Alpha-Beta Pruning, and heuristic board evaluation.

Implements a 7×6 Connect Four game with an interactive web interface, terminal CLI, AI vs AI mode, and configurable search depth.

Features

- Minimax: Adversarial game tree search.
- Alpha-Beta Pruning: Reduces unnecessary search branches.
- Move Ordering: Center-outward column prioritization.
- Transposition Table: Caches previously evaluated positions.
- Heuristic Evaluation: Center control, winning windows, and tactical threats.
- Web Interface: Interactive browser-based gameplay.
- CLI: Terminal-based game with ASCII board rendering.
- AI vs AI: Autonomous gameplay between two bots.
- Difficulty Levels: Depth 3, 5, 7, and 8.
- Undo: Rewind moves and explore alternate positions.
- Benchmarks: Search performance and tactical puzzle tests.

The heuristic function considers:

- Center column control.
- 69 possible four-cell winning windows.
- Offensive and defensive threats.
- Immediate winning and blocking moves.

Installation

git clone https://github.com/iam-alenjoseph/turbo-octo-dollop.git

cd turbo-octo-dollop

npm install

Usage

Web Application

npm start

Open "http://localhost:3000".

