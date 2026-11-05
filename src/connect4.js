/**
 * Connect Four Core Game Logic
 * Grid: 6 rows x 7 columns
 * Row 0 is the bottom, Row 5 is the top.
 * Empty = 0, Human = 1 (Red), AI = 2 (Yellow)
 */

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER_HUMAN = 1;
const PLAYER_AI = 2;

// Precompute all 69 winning 4-in-a-row coordinate windows for maximum evaluation speed
const WINNING_WINDOWS = (() => {
  const windows = [];

  // Horizontal windows (24)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      windows.push([
        [r, c],
        [r, c + 1],
        [r, c + 2],
        [r, c + 3]
      ]);
    }
  }

  // Vertical windows (21)
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      windows.push([
        [r, c],
        [r + 1, c],
        [r + 2, c],
        [r + 3, c]
      ]);
    }
  }

  // Positively sloped diagonals (12)
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      windows.push([
        [r, c],
        [r + 1, c + 1],
        [r + 2, c + 2],
        [r + 3, c + 3]
      ]);
    }
  }

  // Negatively sloped diagonals (12)
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      windows.push([
        [r, c],
        [r - 1, c + 1],
        [r - 2, c + 2],
        [r - 3, c + 3]
      ]);
    }
  }

  return windows;
})();

class Connect4 {
  constructor() {
    this.reset();
  }

  reset() {
    // board[row][col], row 0 is bottom
    this.board = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    // Number of pieces currently in each column (heights)
    this.heights = new Uint8Array(COLS);
    this.movesCount = 0;
    this.lastMove = null; // { row, col, player }
    this.winningCells = null;
    this.gameOver = false;
    this.winner = null; // null, 1, 2, or 'DRAW'
  }

  clone() {
    const copy = new Connect4();
    for (let r = 0; r < ROWS; r++) {
      copy.board[r].set(this.board[r]);
    }
    copy.heights.set(this.heights);
    copy.movesCount = this.movesCount;
    copy.gameOver = this.gameOver;
    copy.winner = this.winner;
    copy.lastMove = this.lastMove ? { ...this.lastMove } : null;
    copy.winningCells = this.winningCells ? [...this.winningCells] : null;
    return copy;
  }

  isValidMove(col) {
    return col >= 0 && col < COLS && this.heights[col] < ROWS;
  }

  getValidMoves() {
    // Return valid columns. Center-first order prioritizes high-value branches
    const order = [3, 2, 4, 1, 5, 0, 6];
    const valid = [];
    for (let i = 0; i < COLS; i++) {
      const col = order[i];
      if (this.heights[col] < ROWS) {
        valid.push(col);
      }
    }
    return valid;
  }

  makeMove(col, player) {
    if (!this.isValidMove(col) || this.gameOver) {
      return -1;
    }

    const row = this.heights[col];
    this.board[row][col] = player;
    this.heights[col]++;
    this.movesCount++;
    this.lastMove = { row, col, player };

    const win = this.checkWinAt(row, col, player);
    if (win) {
      this.gameOver = true;
      this.winner = player;
      this.winningCells = win;
    } else if (this.movesCount === ROWS * COLS) {
      this.gameOver = true;
      this.winner = 'DRAW';
    }

    return row;
  }

  undoMove(col) {
    if (col < 0 || col >= COLS || this.heights[col] === 0) {
      return false;
    }
    const row = this.heights[col] - 1;
    this.board[row][col] = EMPTY;
    this.heights[col]--;
    this.movesCount--;
    this.gameOver = false;
    this.winner = null;
    this.winningCells = null;
    this.lastMove = null;
    return true;
  }

  checkWinAt(row, col, player) {
    // Fast localized 4-in-a-row check around the last placed piece
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal /
      [1, -1]  // Diagonal \
    ];

    for (const [dr, dc] of directions) {
      const streak = [[row, col]];

      // Check forward
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.board[r][c] === player) {
        streak.push([r, c]);
        r += dr;
        c += dc;
      }

      // Check backward
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.board[r][c] === player) {
        streak.push([r, c]);
        r -= dr;
        c -= dc;
      }

      if (streak.length >= 4) {
        return streak;
      }
    }

    return null;
  }

  // Quick check if a player has won anywhere on board
  checkWinner() {
    for (let i = 0; i < WINNING_WINDOWS.length; i++) {
      const win = WINNING_WINDOWS[i];
      const p = this.board[win[0][0]][win[0][1]];
      if (p !== EMPTY &&
          p === this.board[win[1][0]][win[1][1]] &&
          p === this.board[win[2][0]][win[2][1]] &&
          p === this.board[win[3][0]][win[3][1]]) {
        return { winner: p, cells: win };
      }
    }
    if (this.movesCount === ROWS * COLS) {
      return { winner: 'DRAW', cells: null };
    }
    return null;
  }

  // Fast unique 64-bit integer or string state hash for transposition caching
  getHashKey() {
    // 42 cells, each has 3 states (0, 1, 2)
    // Flatten rows into a compact string representation
    let key = '';
    for (let c = 0; c < COLS; c++) {
      key += this.heights[c];
      for (let r = 0; r < this.heights[c]; r++) {
        key += this.board[r][c];
      }
      key += '|';
    }
    return key;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Connect4,
    ROWS,
    COLS,
    EMPTY,
    PLAYER_HUMAN,
    PLAYER_AI,
    WINNING_WINDOWS
  };
} else if (typeof window !== 'undefined') {
  window.Connect4 = Connect4;
  window.ROWS = ROWS;
  window.COLS = COLS;
  window.EMPTY = EMPTY;
  window.PLAYER_HUMAN = PLAYER_HUMAN;
  window.PLAYER_AI = PLAYER_AI;
  window.WINNING_WINDOWS = WINNING_WINDOWS;
}
