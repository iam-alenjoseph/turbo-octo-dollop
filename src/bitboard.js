/**
 * High-Performance 64-bit Bitboard Engine for Connect Four
 * Based on John Tromp's Bitboard Representation.
 * 
 * Board layout (49 bits):
 *  5 12 19 26 33 40 47   (Row 5 - Top)
 *  4 11 18 25 32 39 46
 *  3 10 17 24 31 38 45
 *  2  9 16 23 30 37 44
 *  1  8 15 22 29 36 43
 *  0  7 14 21 28 35 42   (Row 0 - Bottom)
 *  6 13 20 27 34 41 48   (Row 6 - Sentinel zeros preventing bit wraparound)
 */

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER_HUMAN = 1;
const PLAYER_AI = 2;

// Column bitmasks
const BOTTOM_MASKS = new Array(COLS);
const TOP_MASKS = new Array(COLS);
const COLUMN_MASKS = new Array(COLS);

for (let c = 0; c < COLS; c++) {
  BOTTOM_MASKS[c] = 1n << BigInt(c * 7);
  TOP_MASKS[c] = 1n << BigInt(c * 7 + 5);
  COLUMN_MASKS[c] = 0b111111n << BigInt(c * 7);
}

class Bitboard {
  constructor() {
    this.reset();
  }

  reset() {
    this.position = 0n; // Bitmask of current player's pieces
    this.mask = 0n;     // Bitmask of all placed pieces (both players)
    this.moves = 0;
    this.history = [];  // Array of column moves
  }

  clone() {
    const copy = new Bitboard();
    copy.position = this.position;
    copy.mask = this.mask;
    copy.moves = this.moves;
    copy.history = [...this.history];
    return copy;
  }

  /**
   * Check if a column has room for another piece
   */
  isValidMove(col) {
    if (col < 0 || col >= COLS) return false;
    return (this.mask & TOP_MASKS[col]) === 0n;
  }

  /**
   * Return array of valid column moves
   */
  getValidMoves() {
    const order = [3, 2, 4, 1, 5, 0, 6]; // Central ordering
    const valid = [];
    for (let i = 0; i < COLS; i++) {
      const col = order[i];
      if ((this.mask & TOP_MASKS[col]) === 0n) {
        valid.push(col);
      }
    }
    return valid;
  }

  /**
   * Drops a piece in `col` for the current player.
   * Alternates the board representation so `position` represents the OTHER player on next turn.
   */
  makeMove(col) {
    if (!this.isValidMove(col)) return false;

    // The newly occupied cell is given by adding the bottom cell bit to mask
    const newMask = this.mask | (this.mask + BOTTOM_MASKS[col]);
    // Next player's position is (old mask XOR old position)
    this.position ^= this.mask;
    this.mask = newMask;
    this.moves++;
    this.history.push(col);
    return true;
  }

  /**
   * Undo the last move
   */
  undoMove() {
    if (this.history.length === 0) return false;
    const lastCol = this.history.pop();
    this.moves--;

    // Clear the highest bit in lastCol
    const colMask = COLUMN_MASKS[lastCol];
    const colPieces = this.mask & colMask;
    // Find the highest bit in colPieces
    let highestBit = 0n;
    for (let r = 5; r >= 0; r--) {
      const bit = 1n << BigInt(lastCol * 7 + r);
      if ((colPieces & bit) !== 0n) {
        highestBit = bit;
        break;
      }
    }

    this.mask ^= highestBit;
    this.position ^= this.mask; // Flip back to previous player
    return true;
  }

  /**
   * Sub-nanosecond win check on arbitrary bitboard position
   */
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

  /**
   * Check if current player or previous player has won
   */
  isWinForLastPlayer() {
    // Last player's pieces are: current position ^ current mask
    const lastPlayerPos = this.position ^ this.mask;
    return Bitboard.checkWin(lastPlayerPos);
  }

  isWinForCurrentPlayer() {
    return Bitboard.checkWin(this.position);
  }

  isBoardFull() {
    return this.moves === ROWS * COLS;
  }

  /**
   * Get 2D array representation for rendering
   * 0 = Empty, 1 = Human, 2 = AI
   */
  toArray2D(humanFirst = true) {
    const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    // Reconstruct moves from history
    let p = humanFirst ? PLAYER_HUMAN : PLAYER_AI;
    const colHeights = new Array(COLS).fill(0);

    for (const c of this.history) {
      const r = colHeights[c];
      grid[r][c] = p;
      colHeights[c]++;
      p = (p === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
    }
    return grid;
  }

  /**
   * Compute 64-bit unique state key
   */
  getKey() {
    // Mask + Position + Bottom gives a unique bijection for every reachable board
    return this.position + this.mask;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Bitboard,
    BOTTOM_MASKS,
    TOP_MASKS,
    COLUMN_MASKS,
    ROWS,
    COLS,
    EMPTY,
    PLAYER_HUMAN,
    PLAYER_AI
  };
} else if (typeof window !== 'undefined') {
  window.Bitboard = Bitboard;
  window.BOTTOM_MASKS = BOTTOM_MASKS;
  window.TOP_MASKS = TOP_MASKS;
  window.COLUMN_MASKS = COLUMN_MASKS;
}
