# Connect Four Engine Specification

A competitive Connect Four adversarial search engine built in JavaScript using 64-bit bitboards, Negamax with Alpha-Beta pruning, Principal Variation Search (PVS), Zobrist transposition tables, and Web Worker background execution.

---

## 1. Bitboard Representation

A standard Connect Four board is 7 columns by 6 rows (42 playable slots).

Instead of a 2D array, the board state is packed into two 64-bit integers:
- position: bitmask of the current player's pieces
- mask: bitmask of all occupied cells on the board

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
The 7th bit of each column is permanently set to 0. When bit-shifting horizontally or diagonally, the sentinel bit acts as a boundary fence, preventing bits in row 5 of column C from bleeding into row 0 of column C+1.

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

The entire board is verified in 8 CPU instructions without looping over 69 coordinate windows.

### 1.3 Move Generation & Gravity
Dropping a chip in column col:
```javascript
const newMask = mask | (mask + (1n << BigInt(col * 7)));
const newPosition = position ^ mask;
```

---

## 2. Search Pipeline

### 2.1 Negamax Formulation
Negamax relies on zero-sum symmetry: max(a, b) = -min(-a, -b).
Every recursive call negates the evaluation and flips the search window.

### 2.2 Principal Variation Search (PVS)
1. Evaluate move 0 with the full window: [-beta, -alpha].
2. Evaluate moves 1 through N with a zero-width scout window: [-alpha - 1, -alpha].
3. If a scout search returns a score > alpha, re-search with the full window [-beta, -alpha].

### 2.3 Move Ordering Priority
1. Transposition Table move
2. Immediate winning moves
3. Killer moves
4. History heuristic score
5. Center-outward proximity [3, 2, 4, 1, 5, 0, 6]

### 2.4 Transposition Table & Zobrist Hashing
Board state key uniquely maps the 42 cells. Stored records contain depth, score, flag (EXACT, LOWERBOUND, UPPERBOUND), and bestMove.

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

Search computation is offloaded to a dedicated Web Worker (worker.js) to keep the UI responsive at 60 FPS.
