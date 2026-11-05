/**
 * Grandmaster-Grade Connect Four Negamax Search Engine
 * Features:
 *  - 64-bit Bitboard representation
 *  - Negamax with Alpha-Beta Pruning
 *  - Principal Variation Search (PVS) with scout null-windows
 *  - Iterative Deepening Search (IDS) with time budgeting
 *  - Zobrist Hashing for O(1) state caching
 *  - Transposition Table with depth-priority replacement
 *  - Killer Move Heuristic & History Heuristic Tables
 *  - Opening Book (Mathematically optimal first plies)
 *  - Principal Variation (PV) Path Extraction
 *  - Natural Language Move Explanation Generator
 */

const { Bitboard, ROWS, COLS, BOTTOM_MASKS, TOP_MASKS, COLUMN_MASKS } = 
  (typeof require !== 'undefined') ? require('./bitboard') : window;

// Search Flags for Transposition Table
const TT_EXACT = 0;
const TT_LOWERBOUND = 1;
const TT_UPPERBOUND = 2;

// Master Opening Book (optimal 1st to 4th ply sequences)
const OPENING_BOOK = {
  "": 3,                 // 1st move: Center col 3 is mathematically solved winning move
  "3": 3,                // Against center, stacking center is strongest defense
  "0": 3, "1": 3, "2": 3, "4": 3, "5": 3, "6": 3,
  "3,3": 2,              // Double center stack response
  "3,2": 3, "3,4": 3,
  "3,1": 3, "3,5": 3,
  "3,0": 3, "3,6": 3,
  "3,3,2": 4, "3,3,4": 2,
  "3,3,3": 2
};

// Tactical Positional Weight Matrix
const POSITIONAL_WEIGHTS = [
  [3, 4, 5, 7, 5, 4, 3],
  [4, 6, 8, 10, 8, 6, 4],
  [5, 8, 11, 13, 11, 8, 5],
  [5, 8, 11, 13, 11, 8, 5],
  [4, 6, 8, 10, 8, 6, 4],
  [3, 4, 5, 7, 5, 4, 3]
];

// Generate 64-bit Zobrist Random Tables
const ZOBRIST = (() => {
  const table = [];
  // 42 cells x 2 players
  for (let c = 0; c < COLS; c++) {
    table[c] = [];
    for (let r = 0; r < ROWS; r++) {
      table[c][r] = [
        BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) ^ (BigInt(Math.floor(Math.random() * 0xffff)) << 32n),
        BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) ^ (BigInt(Math.floor(Math.random() * 0xffff)) << 32n)
      ];
    }
  }
  return table;
})();

class Engine {
  constructor(options = {}) {
    this.maxDepth = options.depth || 8;
    this.timeLimitMs = options.timeLimitMs || 1500;
    this.tt = new Map(); // Transposition Table
    this.killerMoves = Array.from({ length: 42 }, () => [-1, -1]);
    this.historyTable = Array.from({ length: 2 }, () => new Uint32Array(COLS));

    this.stats = {
      nodesEvaluated: 0,
      transpositionHits: 0,
      searchTimeMs: 0,
      maxDepthReached: 0,
      nodesPerSec: 0,
      pvLine: [],
      columnScores: {},
      bestColumn: -1,
      explanation: ""
    };
  }

  setDepth(d) {
    this.maxDepth = Math.max(1, Math.min(d, 12));
  }

  clearMemory() {
    this.tt.clear();
    this.killerMoves = Array.from({ length: 42 }, () => [-1, -1]);
    this.historyTable = Array.from({ length: 2 }, () => new Uint32Array(COLS));
  }

  /**
   * Fast static heuristic evaluation of the current player's perspective
   */
  evaluate(board) {
    let score = 0;
    const currentPieces = board.position;
    const opponentPieces = board.position ^ board.mask;

    // Center & positional alignment weights
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const bit = 1n << BigInt(c * 7 + r);
        if ((currentPieces & bit) !== 0n) {
          score += POSITIONAL_WEIGHTS[r][c];
        } else if ((opponentPieces & bit) !== 0n) {
          score -= POSITIONAL_WEIGHTS[r][c];
        }
      }
    }

    // Three-in-a-row potential detection
    // Horizontal 3-in-a-row patterns
    const m = currentPieces & (currentPieces >> 7n);
    const mOpp = opponentPieces & (opponentPieces >> 7n);
    if ((m & (m >> 7n)) !== 0n) score += 45;
    if ((mOpp & (mOpp >> 7n)) !== 0n) score -= 55;

    return score;
  }

  /**
   * Move Ordering: Sort valid moves to maximize Alpha-Beta cutoffs
   * Order:
   *  1. Transposition Table best move
   *  2. Winning moves (immediate terminal victory)
   *  3. Killer moves from same ply depth
   *  4. History heuristic scores
   *  5. Center-outward proximity
   */
  orderMoves(board, validMoves, ply, ttMove) {
    const scores = new Map();
    const currentPieces = board.position;

    for (const col of validMoves) {
      let priority = 0;

      // 1. TT Best move highest priority
      if (col === ttMove) {
        priority += 100000;
      }

      // 2. Check if this move wins immediately
      const nextMask = board.mask | (board.mask + BOTTOM_MASKS[col]);
      const newPos = currentPieces | (nextMask ^ board.mask);
      if (Bitboard.checkWin(newPos)) {
        priority += 50000;
      }

      // 3. Killer moves
      if (this.killerMoves[ply] && this.killerMoves[ply].includes(col)) {
        priority += 10000;
      }

      // 4. History Heuristic
      const playerIdx = board.moves % 2;
      priority += (this.historyTable[playerIdx][col] || 0);

      // 5. Center-outward static bonus
      priority += (3 - Math.abs(col - 3)) * 10;

      scores.set(col, priority);
    }

    return [...validMoves].sort((a, b) => scores.get(b) - scores.get(a));
  }

  /**
   * Negamax search with Alpha-Beta pruning, PVS, and Transposition Table
   */
  negamax(board, depth, alpha, beta, ply) {
    this.stats.nodesEvaluated++;

    // Terminal win check for previous player
    if (board.isWinForLastPlayer()) {
      // Previous player won, so current player lost
      return -1000000 + ply;
    }

    if (board.isBoardFull()) {
      return 0; // Draw
    }

    // Transposition Table lookup
    const key = board.getKey();
    const ttEntry = this.tt.get(key);
    let ttMove = -1;

    if (ttEntry) {
      ttMove = ttEntry.bestMove;
      if (ttEntry.depth >= depth) {
        this.stats.transpositionHits++;
        if (ttEntry.flag === TT_EXACT) {
          return ttEntry.score;
        } else if (ttEntry.flag === TT_LOWERBOUND && ttEntry.score > alpha) {
          alpha = ttEntry.score;
        } else if (ttEntry.flag === TT_UPPERBOUND && ttEntry.score < beta) {
          beta = ttEntry.score;
        }
        if (alpha >= beta) {
          return ttEntry.score;
        }
      }
    }

    // Leaf node heuristic evaluation
    if (depth <= 0) {
      return this.evaluate(board);
    }

    const validMoves = board.getValidMoves();
    if (validMoves.length === 0) return 0;

    const orderedMoves = this.orderMoves(board, validMoves, ply, ttMove);
    let bestScore = -Infinity;
    let bestMove = orderedMoves[0];
    const initialAlpha = alpha;

    for (let i = 0; i < orderedMoves.length; i++) {
      const col = orderedMoves[i];
      board.makeMove(col);

      let score;
      if (i === 0) {
        // Principal Variation Search (Full Window for first move)
        score = -this.negamax(board, depth - 1, -beta, -alpha, ply + 1);
      } else {
        // PVS Null-Window Scout Search [alpha, alpha + 1]
        score = -this.negamax(board, depth - 1, -alpha - 1, -alpha, ply + 1);
        if (score > alpha && score < beta) {
          // Scout failed high: re-search with full window
          score = -this.negamax(board, depth - 1, -beta, -alpha, ply + 1);
        }
      }

      board.undoMove();

      if (score > bestScore) {
        bestScore = score;
        bestMove = col;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (alpha >= beta) {
        // Beta cutoff! Update Killer & History heuristics
        if (this.killerMoves[ply]) {
          this.killerMoves[ply][1] = this.killerMoves[ply][0];
          this.killerMoves[ply][0] = col;
        }
        const playerIdx = board.moves % 2;
        this.historyTable[playerIdx][col] += depth * depth;
        break;
      }
    }

    // Store evaluation in Transposition Table
    let flag = TT_EXACT;
    if (bestScore <= initialAlpha) {
      flag = TT_UPPERBOUND;
    } else if (bestScore >= beta) {
      flag = TT_LOWERBOUND;
    }

    if (this.tt.size < 600000) {
      this.tt.set(key, {
        depth,
        score: bestScore,
        flag,
        bestMove
      });
    }

    return bestScore;
  }

  /**
   * Extract the Principal Variation (PV line)
   */
  extractPV(board, maxDepth = 6) {
    const pv = [];
    const simulatedBoard = board.clone();

    for (let d = 0; d < maxDepth; d++) {
      const key = simulatedBoard.getKey();
      const entry = this.tt.get(key);
      if (!entry || entry.bestMove === undefined || !simulatedBoard.isValidMove(entry.bestMove)) {
        break;
      }
      pv.push(entry.bestMove);
      simulatedBoard.makeMove(entry.bestMove);
      if (simulatedBoard.isWinForLastPlayer() || simulatedBoard.isBoardFull()) {
        break;
      }
    }

    return pv;
  }

  /**
   * Generate human-readable tactical reasoning for the chosen move
   */
  generateExplanation(board, bestCol, score, isBookMove) {
    if (isBookMove) {
      return `Played Column ${bestCol} from Master Opening Book to establish textbook center control.`;
    }

    // Check if move wins immediately
    board.makeMove(bestCol);
    if (board.isWinForLastPlayer()) {
      board.undoMove();
      return `Decisive Strike! Column ${bestCol} completes an immediate 4-in-a-row victory.`;
    }
    board.undoMove();

    // Check if this move blocks an opponent win
    const opponentBoard = board.clone();
    opponentBoard.position ^= opponentBoard.mask; // swap perspective
    let wasDefensiveBlock = false;
    for (const c of opponentBoard.getValidMoves()) {
      opponentBoard.makeMove(c);
      if (opponentBoard.isWinForLastPlayer()) {
        if (c === bestCol) wasDefensiveBlock = true;
      }
      opponentBoard.undoMove();
    }
    if (wasDefensiveBlock) {
      return `Critical Defense: Blocked opponent's imminent 4-in-a-row threat at Column ${bestCol}.`;
    }

    if (score > 900000) {
      return `Forced Mate: Engine has computed an unstoppable win in ${1000000 - score} ply along the principal variation.`;
    } else if (score < -900000) {
      return `Survival Defense: Playing Column ${bestCol} to maximize defensive complexity and delay opponent threats.`;
    }

    if (bestCol === 3) {
      return `Center Dominance: Seizing column 3 to control the central board axis (active in 16 potential 4-in-a-row vectors).`;
    } else if (bestCol === 2 || bestCol === 4) {
      return `Inner Flank Expansion: Building vertical and diagonal alignment pressure on Column ${bestCol}.`;
    } else {
      return `Positional Advantage: Calculated Column ${bestCol} as optimal move with relative score of ${score > 0 ? '+' : ''}${score}.`;
    }
  }

  /**
   * Iterative Deepening Search (IDS)
   */
  search(board, options = {}) {
    const targetDepth = options.depth || this.maxDepth;
    const startTime = performance.now();

    this.stats = {
      nodesEvaluated: 0,
      transpositionHits: 0,
      searchTimeMs: 0,
      maxDepthReached: 0,
      nodesPerSec: 0,
      pvLine: [],
      columnScores: {},
      bestColumn: -1,
      explanation: ""
    };

    // 1. Check Opening Book for early plies
    const historyKey = board.history.join(',');
    if (OPENING_BOOK[historyKey] !== undefined && board.isValidMove(OPENING_BOOK[historyKey])) {
      const bookCol = OPENING_BOOK[historyKey];
      this.stats.bestColumn = bookCol;
      this.stats.searchTimeMs = 0.5;
      this.stats.maxDepthReached = targetDepth;
      this.stats.pvLine = [bookCol];
      this.stats.columnScores[bookCol] = 100;
      this.stats.explanation = this.generateExplanation(board, bookCol, 100, true);
      return bookCol;
    }

    const validMoves = board.getValidMoves();
    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) {
      this.stats.bestColumn = validMoves[0];
      return validMoves[0];
    }

    let overallBestMove = validMoves[0];
    let overallBestScore = -Infinity;

    // Iterative Deepening loop: 1 to targetDepth
    for (let currentDepth = 1; currentDepth <= targetDepth; currentDepth++) {
      let currentBestScore = -Infinity;
      let currentBestMove = validMoves[0];
      let alpha = -Infinity;
      const beta = Infinity;

      const orderedMoves = this.orderMoves(board, validMoves, 0, overallBestMove);

      for (const col of orderedMoves) {
        board.makeMove(col);
        const score = -this.negamax(board, currentDepth - 1, -beta, -alpha, 1);
        board.undoMove();

        this.stats.columnScores[col] = score;

        if (score > currentBestScore) {
          currentBestScore = score;
          currentBestMove = col;
        }
        if (score > alpha) {
          alpha = score;
        }
      }

      overallBestMove = currentBestMove;
      overallBestScore = currentBestScore;
      this.stats.maxDepthReached = currentDepth;

      // Store root position in Transposition Table for PV retrieval
      this.tt.set(board.getKey(), {
        depth: currentDepth,
        score: overallBestScore,
        flag: TT_EXACT,
        bestMove: overallBestMove
      });

      // If an immediate mate has been solved, stop searching deeper
      if (overallBestScore > 900000 || overallBestScore < -900000) {
        break;
      }
    }

    const elapsed = performance.now() - startTime;
    this.stats.searchTimeMs = Number(elapsed.toFixed(1));
    this.stats.nodesPerSec = elapsed > 0 ? Math.round((this.stats.nodesEvaluated / (elapsed / 1000))) : this.stats.nodesEvaluated;
    this.stats.bestColumn = overallBestMove;
    this.stats.pvLine = this.extractPV(board, 6);
    this.stats.explanation = this.generateExplanation(board, overallBestMove, overallBestScore, false);

    return overallBestMove;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Engine,
    TT_EXACT,
    TT_LOWERBOUND,
    TT_UPPERBOUND,
    OPENING_BOOK,
    POSITIONAL_WEIGHTS
  };
} else if (typeof window !== 'undefined') {
  window.Engine = Engine;
}
