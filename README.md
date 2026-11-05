# 🤖 Connect Four — Intelligent Minimax Game Tree Bot

An adversarial zero-sum AI bot engineered to consistently defeat human players at **Connect Four (7×6)** using the **Minimax Game Tree Algorithm** enhanced with **Alpha-Beta Pruning**, **Center-Outward Move Ordering**, **Transposition Memoization**, and **Positional Threat Heuristics**.

---

## ⚡ Quick Start

### 1. Launch the Interactive Web App
You can run the built-in zero-dependency server:

```bash
npm start
# or: node server.js
```
Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

*(You can also double-click `index.html` directly in File Explorer — no server required!)*

### 2. Play in the Terminal CLI
If you prefer playing directly in your command line with colored ASCII rendering:

```bash
npm run cli
# or: node cli.js
```

### 3. Run Engine Benchmarks & Tactical Puzzle Tests
```bash
npm test
# or: node test/benchmark.js
```

---

## 🧠 Algorithmic Architecture

Connect Four has an estimated state-space complexity of approximately $4.5 \times 10^{12}$ positions. To make optimal decisions in real-time, this bot leverages a multi-layered adversarial search pipeline:

```
                      Current Board State
                              │
               ┌──────────────┴──────────────┐
       [Immediate Win?]              [Immediate Block?]
          YES │                          YES │
       Play Win!                     Play Block!
          NO  │                          NO  │
               └──────────────┬──────────────┘
                              ▼
            Transposition Table Lookup (Cache Hit?)
                              │
                     ┌────────┴────────┐
                 Found?              Miss
                     │                 │
                Prune / Bound          ▼
                               Move Ordering
                       [Col 3, 2, 4, 1, 5, 0, 6]
                                       │
                                       ▼
                          Minimax Search (Depth 7–8)
                         ┌─────────────┴─────────────┐
                    Alpha-Beta                   Static Board
                  Cutoff Branch?                 Evaluation
                        │                             │
                   Prune Subtree            - Center Column Control
                                            - 69 Precomputed Windows
                                            - Multi-Threat Traps
```

### 1. Minimax Formulation
Connect Four is modeled as an alternating two-player zero-sum game with perfect information:
- **Maximizer (AI):** Aims to maximize the evaluation score $V(s)$.
- **Minimizer (Human):** Assumed to play rationally to minimize the evaluation score.

$$\text{Minimax}(s, d) = \begin{cases} 
\text{Utility}(s), & \text{if } \text{Terminal}(s) \text{ or } d = 0 \\
\max_{a \in \text{Actions}(s)} \text{Minimax}(\text{Result}(s, a), d - 1), & \text{if Player}(s) = \text{AI} \\
\min_{a \in \text{Actions}(s)} \text{Minimax}(\text{Result}(s, a), d - 1), & \text{if Player}(s) = \text{Human}
\end{cases}$$

### 2. Alpha-Beta Pruning
Alpha-Beta pruning dynamically maintains two threshold bounds during depth-first tree traversal:
- **$\alpha$**: The minimum score the maximizing player is guaranteed.
- **$\beta$**: The maximum score the minimizing player is guaranteed.

Whenever a branch yields $\alpha \ge \beta$, the remaining children of that node are pruned, cutting tree size from $O(b^d)$ to $O(b^{d/2})$ under optimal move ordering:

| Search Depth | Standard Minimax Nodes ($7^d$) | Alpha-Beta + Move Ordering Nodes | Execution Time |
| :---: | :---: | :---: | :---: |
| **Depth 3** | $343$ | $\sim 130$ | $< 3\text{ ms}$ |
| **Depth 5** | $16,807$ | $\sim 1,500$ | $< 6\text{ ms}$ |
| **Depth 7** | $823,543$ | $\sim 12,800$ | $\sim 29\text{ ms}$ |
| **Depth 8** | $5,764,801$ | $\sim 45,000$ | $\sim 104\text{ ms}$ |

*Evaluates over **430,000 nodes/second** in JavaScript.*

### 3. Center-Outward Move Ordering
In Connect Four, column 3 (the exact center) participates in **16** distinct 4-in-a-row alignments, while edge columns participate in only 4. 

By prioritizing moves in order `[3, 2, 4, 1, 5, 0, 6]`, high-utility moves are explored first, triggering immediate $\beta$-cutoffs and eliminating large subtrees before they are traversed.

### 4. Heuristic Evaluation Function
When the search reaches cutoff depth $d=0$, non-terminal positions are scored across three dimensions:
1. **Positional Weight Map:** Center columns receive quadratic weight multipliers.
2. **69 Sliding 4-Cell Windows:** Precomputed coordinates for all horizontal, vertical, and diagonal lines:
   - 3 AI pieces + 1 open: $+120\text{ pts}$ (offensive threat)
   - 2 AI pieces + 2 open: $+12\text{ pts}$ (potential buildup)
   - 3 Opponent pieces + 1 open: $-140\text{ pts}$ (urgent defensive counter)
   - 2 Opponent pieces + 2 open: $-14\text{ pts}$ (opponent containment)
3. **Tactical Fast-Paths:** Immediate 1-ply winning moves and must-block opponent alignments are identified before deep recursive tree descent.

---

## 🎮 Interactive Web Features

- **Live AI Brain Telemetry:** Displays total nodes searched, search depth, think time (ms), and transposition cache hit rate.
- **Chess-Style Evaluation Bar:** Dynamic visual advantage meter indicating whether the AI or human has positional superiority.
- **Real-Time Column Scores:** Shows the evaluated minimax score for all 7 columns.
- **Synthesized Sound FX:** Zero-asset retro/tactile audio built with the HTML5 Web Audio API.
- **Difficulty Modes:**
  - *Casual* (Depth 3)
  - *Medium* (Depth 5)
  - *Hard* (Depth 7 - Standard)
  - *Grandmaster* (Depth 8 - Superhuman)
- **AI vs AI Spectator Mode:** Watch two AI bots compete autonomously.
- **Undo Move Support:** Rewind turns to experiment with alternate branches.

---

## 📁 Repository Structure

```
BOTTY/
├── index.html          # Web UI layout & styling structure
├── style.css           # Glassmorphism dark cyberpunk UI theme
├── app.js              # DOM controllers, Web Audio FX & game loop
├── cli.js              # Full-featured terminal interface
├── server.js           # Lightweight static server (zero dependencies)
├── package.json        # NPM scripts & metadata
├── src/
│   ├── connect4.js     # 7x6 bitboard/grid logic & win verification
│   └── minimax.js      # Alpha-Beta minimax engine & heuristic evaluation
└── test/
    └── benchmark.js    # Performance benchmarks & tactical puzzle suites
```

---

## 📜 License
MIT License. Created for competitive game tree research and AI demonstration.
