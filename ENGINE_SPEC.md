# Connect Four Engine Specification

A competitive Connect Four adversarial search engine built in JavaScript using 64-bit bitboards, Negamax with Alpha-Beta pruning, Principal Variation Search (PVS), Zobrist transposition tables, and Web Worker background execution.

---

## 1. Bitboard Representation

A standard Connect Four board is 7 columns by 6 rows (42 playable slots).

Instead of a 2D array (`board[6][7]`), the board state is packed into two 64-bit integers (`BigInt` in JS):
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

### 1.1 Sentinel Bit Boundary
The 7th bit of each column is permanently set to `0`. When bit-shifting horizontally (`>> 7n`) or diagonally (`>> 8n` or `>> 6n`), the sentinel bit acts as a boundary fence, preventing bits in row 5 of column $C$ from bleeding into row 0 of column $C+1$.

### 1.2 Win Detection
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

The entire board is verified in ~8 CPU instructions without looping over 69 coordinate windows.

### 1.3 Move Generation & Gravity
Dropping a chip in column `col`:
```javascript
const newMask = mask | (mask + (1n << BigInt(col * 7)));
const newPosition = position ^ mask;
```
Adding the bottom bit of `col` naturally cascades to the lowest unoccupied cell in that column via binary carry addition.

---

## 2. Search Pipeline

### 2.1 Negamax Formulation
Negamax relies on zero-sum symmetry: $\max(a, b) = -\min(-a, -b)$.  
Every recursive call negates the evaluation and flips the search window:
```javascript
score = -this.negamax(board, depth - 1, -beta, -alpha, ply + 1);
```

### 2.2 Principal Variation Search (PVS)
Standard Alpha-Beta runs full-width searches on every legal move. PVS assumes move ordering is mostly accurate (the first move evaluated is likely the best move):

1. Evaluate move 0 with the full window: `[-beta, -alpha]`.
2. Evaluate moves 1 through $N$ with a zero-width scout window: `[-alpha - 1, -alpha]`.
3. If a scout search returns a score $> \alpha$, the initial assumption failed ("failed high"). Re-search that specific move with the full window `[-beta, -alpha]`.

This significantly reduces the number of nodes evaluated on suboptimal branches.

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

## 4. Concurrency via Web Workers

To keep the UI responsive at 60 FPS, search computation is completely offloaded to a dedicated Web Worker (`worker.js`). The worker receives the move history, executes iterative deepening search in the background, and posts progress back to the main UI thread via asynchronous message passing.
