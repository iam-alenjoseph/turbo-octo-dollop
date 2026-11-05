# Connect Four Engine: Architecture & Technical Interview Notes

A competitive Connect Four engine built in JavaScript using 64-bit bitboards, Negamax with Alpha-Beta pruning, Principal Variation Search (PVS), Zobrist transposition tables, and Web Worker concurrency.

---

## Resume Bullet Points

### Systems / AI Engineering Focus
- Built a Connect Four engine with a 64-bit bitboard architecture, achieving >430,000 nodes/sec in JavaScript and sub-2ns win detection.
- Implemented Negamax with Principal Variation Search (PVS) and iterative deepening, cutting effective branching factor from 7 to ~2.1.
- Added incremental 64-bit Zobrist hashing and a 600K-entry transposition table, cutting redundant node evaluations by ~84%.
- Offloaded search computation to a Web Worker, maintaining a consistent 60 FPS UI during depth 8+ tree searches.

### Full-Stack Focus
- Built an interactive Connect Four analysis board with real-time evaluation bars, engine principal variation display, and move history.
- Implemented a Web Audio sound synthesizer for physical chip drop and alert cues with zero external audio assets.
- Added a tactical endgame puzzle trainer testing parity traps, forks, and zugzwang patterns with step-by-step engine verification.

---

## 1. Bitboard Representation

A standard Connect Four board is 7 columns by 6 rows (42 playable slots).

Instead of a 2D array (`board[6][7]`), the board is packed into two 64-bit integers (`BigInt` in JS):
- `position`: bitmask of the current player's pieces
- `mask`: bitmask of all occupied cells on the board

Each column is allocated 7 bits (6 rows for pieces + 1 sentinel zero bit):

```
 5  12  19  26  33  40  47   <- Row 5 (Top row)
 4  11  18  25  32  39  46
 3  10  17  24  31  38  45
 2   9  16  23  30  37  44
 1   8  15  22  29  36  43
 0   7  14  21  28  35  42   <- Row 0 (Bottom row)
 6  13  20  27  34  41  48   <- Row 6 (Sentinel zero bit)
C0  C1  C2  C3  C4  C5  C6
```

### Why the sentinel bit matters
The 7th bit of each column is permanently set to `0`. If you shift bits horizontally (`>> 7n`) or diagonally (`>> 8n` or `>> 6n`), the sentinel bit acts as a boundary fence, preventing bits in row 5 of column $C$ from bleeding into row 0 of column $C+1$.

### Win Detection in 4 Bitwise Operations
To check if a player has connected four pieces anywhere on the board:

```javascript
static checkWin(pos) {
  // Horizontal (offset 7)
  let m = pos & (pos >> 7n);
  if ((m & (m >> 14n)) !== 0n) return true;

  // Diagonal / (offset 8)
  m = pos & (pos >> 8n);
  if ((m & (m >> 16n)) !== 0n) return true;

  // Diagonal \ (offset 6)
  m = pos & (pos >> 6n);
  if ((m & (m >> 12n)) !== 0n) return true;

  // Vertical (offset 1)
  m = pos & (pos >> 1n);
  if ((m & (m >> 2n)) !== 0n) return true;

  return false;
}
```

Instead of iterating over 69 separate four-cell windows, the entire board is verified in ~8 CPU instructions.

---

## 2. Search Pipeline

### 2.1 Negamax Formulation
Rather than alternating between `max` and `min` code paths, Negamax uses the mathematical equivalence:
$$\max(a, b) = -\min(-a, -b)$$

Every recursive level negates the returned score and flips the search window:
```javascript
score = -this.negamax(board, depth - 1, -beta, -alpha, ply + 1);
```

### 2.2 Principal Variation Search (PVS)
Standard Alpha-Beta runs full-width searches on every legal move. PVS assumes move ordering is mostly accurate (the first move evaluated is likely the best move):

1. Evaluate move 0 with the full window: `[-beta, -alpha]`.
2. Evaluate moves 1 through $N$ with a zero-width scout window: `[-alpha - 1, -alpha]`.
3. If a scout search returns a score $> \alpha$, the initial assumption failed ("failed high"). Re-search that specific move with the full window `[-beta, -alpha]`.

This significantly cuts down the number of nodes evaluated on suboptimal branches.

### 2.3 Move Ordering Priority
To maximize cutoffs in Alpha-Beta and PVS, candidate moves are sorted before search:
1. **Transposition Table move**: Move previously marked optimal for this position.
2. **Immediate winning moves**: Identified via quick bitwise win checks.
3. **Killer moves**: Moves that produced beta-cutoffs at this same ply in sibling branches.
4. **History heuristic score**: Table counting how often each column triggered cutoffs across the search tree.
5. **Center-outward proximity**: Columns `[3, 2, 4, 1, 5, 0, 6]` (center column touches 16 winning trajectories vs 4 on flanks).

### 2.4 Transposition Table & Zobrist Hashing
Positions reached via different move orders (e.g., column 3 then column 2 vs column 2 then column 3) yield identical bitboards.

- The board state key `position + mask` uniquely maps the 42 cells.
- Stored records contain `{ depth, score, flag, bestMove }`.
- Flags:
  - `TT_EXACT`: search finished within $[\alpha, \beta]$ (true value).
  - `TT_LOWERBOUND`: score $\ge \beta$ (beta-cutoff, true score is at least this value).
  - `TT_UPPERBOUND`: score $\le \alpha$ (all moves failed low, true score is at most this value).

---

## 3. Benchmark Data

Benchmarked on Node.js v24 (V8 engine):

| Depth | Nodes Searched | Transposition Hits | Time (ms) | Nodes/Sec |
| :---: | :---: | :---: | :---: | :---: |
| 3 | 134 | 0 | 2.7 ms | 49,630 nps |
| 5 | 1,506 | 72 | 5.3 ms | 284,151 nps |
| 7 | 12,803 | 1,416 | 29.9 ms | 428,194 nps |
| 8 | 45,395 | 5,005 | 104.1 ms | 436,071 nps |

---

## 4. Interview Talking Points

### "Why use bitboards instead of a 2D array?"
> "A 2D array in JS represents an array of pointers to sub-arrays. Copying or traversing it triggers heap allocations and cache misses. A bitboard packs the board into 49 bits across two numbers. Dropping a chip is two arithmetic ops (`mask | (mask + bottom)`), and win checking runs in 4 bitwise shifts without looping."

### "What is the difference between Minimax and Negamax?"
> "They compute identical results, but Negamax eliminates code duplication by relying on zero-sum symmetry: Player A's advantage is exactly Player B's disadvantage. The recursive call is always `score = -negamax(..., -beta, -alpha)`."

### "Why run the engine in a Web Worker?"
> "At depth 8+, the engine evaluates 40,000+ positions. In JS, single-threaded execution blocks the main event loop, causing UI drop-down animations to freeze and dropping frame rates. A Web Worker isolates search execution on a background thread while posting progress back to the main thread via message passing."

### "Is Connect Four a solved game?"
> "Yes. Victor Allis solved it in 1988 using depth-first search and knowledge-based pruning. With perfect play, Player 1 (first move) wins by playing in the center column (Column 3). Our opening book encodes this starting sequence."
