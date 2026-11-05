/**
 * Minimax Game Tree Engine with Alpha-Beta Pruning,
 * Move Ordering, Transposition Table, and Heuristic Evaluation.
 */

const {
  Connect4,
  ROWS,
  COLS,
  EMPTY,
  PLAYER_HUMAN,
  PLAYER_AI,
  WINNING_WINDOWS
} = (typeof require !== 'undefined') ? require('./connect4') : window;

// Positional weight table: center columns hold far higher strategic value
// col 3 participates in 16 4-in-a-row lines, col 2 & 4 in 12, col 1 & 5 in 8, col 0 & 6 in 4
const COLUMN_WEIGHTS = [3, 4, 6, 9, 6, 4, 3];
const MOVE_EXPLORATION_ORDER = [3, 2, 4, 1, 5, 0, 6];

const FLAG_EXACT = 0;
const FLAG_LOWERBOUND = 1;
const FLAG_UPPERBOUND = 2;

class MinimaxBot {
  constructor(options = {}) {
    this.maxDepth = options.depth || 7;
    this.transpositionTable = new Map();
    this.stats = {
      nodesEvaluated: 0,
      transpositionHits: 0,
      searchTimeMs: 0,
      maxDepthReached: 0,
      columnScores: {},
      bestColumn: -1
    };
  }

  setDepth(depth) {
    this.maxDepth = Math.max(1, Math.min(depth, 9));
  }

  clearTranspositionTable() {
    this.transpositionTable.clear();
  }

  /**
   * Evaluate a 4-cell window heuristic score
   */
  evaluateWindow(w, board, aiPlayer, humanPlayer) {
    let aiCount = 0;
    let humanCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < 4; i++) {
      const piece = board[w[i][0]][w[i][1]];
      if (piece === aiPlayer) aiCount++;
      else if (piece === humanPlayer) humanCount++;
      else emptyCount++;
    }

    if (aiCount === 4) return 100000;
    if (humanCount === 4) return -100000;

    // AI offensive opportunities
    if (aiCount === 3 && emptyCount === 1) return 120;
    if (aiCount === 2 && emptyCount === 2) return 12;

    // Human defensive blocking (higher weight to avoid blindsides)
    if (humanCount === 3 && emptyCount === 1) return -140;
    if (humanCount === 2 && emptyCount === 2) return -14;

    return 0;
  }

  /**
   * Static board evaluation function
   */
  evaluateBoard(game, aiPlayer = PLAYER_AI, humanPlayer = PLAYER_HUMAN) {
    let score = 0;
    const board = game.board;

    // 1. Positional piece placement bonus (center dominance)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r][c];
        if (piece === aiPlayer) {
          score += COLUMN_WEIGHTS[c] * (r + 1);
        } else if (piece === humanPlayer) {
          score -= COLUMN_WEIGHTS[c] * (r + 1);
        }
      }
    }

    // 2. Evaluate all 69 potential 4-in-a-row windows
    for (let i = 0; i < WINNING_WINDOWS.length; i++) {
      score += this.evaluateWindow(WINNING_WINDOWS[i], board, aiPlayer, humanPlayer);
    }

    return score;
  }

  /**
   * Check for an immediate one-move win or must-block threat
   */
  findTacticalMove(game, player) {
    const validMoves = game.getValidMoves();
    for (const col of validMoves) {
      const row = game.makeMove(col, player);
      const isWin = game.checkWinAt(row, col, player);
      game.undoMove(col);
      if (isWin) {
        return col;
      }
    }
    return null;
  }

  /**
   * Minimax search with Alpha-Beta pruning & Transposition Table
   */
  minimax(game, depth, alpha, beta, isMaximizing, aiPlayer, humanPlayer) {
    this.stats.nodesEvaluated++;

    const key = game.getHashKey();
    const ttEntry = this.transpositionTable.get(key);

    if (ttEntry && ttEntry.depth >= depth) {
      this.stats.transpositionHits++;
      if (ttEntry.flag === FLAG_EXACT) {
        return ttEntry.score;
      } else if (ttEntry.flag === FLAG_LOWERBOUND && ttEntry.score > alpha) {
        alpha = ttEntry.score;
      } else if (ttEntry.flag === FLAG_UPPERBOUND && ttEntry.score < beta) {
        beta = ttEntry.score;
      }
      if (alpha >= beta) {
        return ttEntry.score;
      }
    }

    // Terminal node checks
    if (game.gameOver) {
      if (game.winner === aiPlayer) {
        return 1000000 + depth; // Prefer quicker wins
      } else if (game.winner === humanPlayer) {
        return -1000000 - depth; // Delay losses
      } else {
        return 0; // Draw
      }
    }

    if (depth === 0) {
      return this.evaluateBoard(game, aiPlayer, humanPlayer);
    }

    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) {
      return 0; // Draw
    }

    // Move ordering: If transposition table has a best move, prioritize it first
    let moveList = validMoves;
    if (ttEntry && ttEntry.bestCol !== undefined && validMoves.includes(ttEntry.bestCol)) {
      moveList = [ttEntry.bestCol, ...validMoves.filter(c => c !== ttEntry.bestCol)];
    }

    let bestScore = isMaximizing ? -Infinity : Infinity;
    let bestCol = moveList[0];
    const initialAlpha = alpha;

    if (isMaximizing) {
      for (const col of moveList) {
        game.makeMove(col, aiPlayer);
        const score = this.minimax(game, depth - 1, alpha, beta, false, aiPlayer, humanPlayer);
        game.undoMove(col);

        if (score > bestScore) {
          bestScore = score;
          bestCol = col;
        }
        alpha = Math.max(alpha, bestScore);
        if (alpha >= beta) {
          break; // Beta cutoff (Alpha-Beta pruning)
        }
      }
    } else {
      for (const col of moveList) {
        game.makeMove(col, humanPlayer);
        const score = this.minimax(game, depth - 1, alpha, beta, true, aiPlayer, humanPlayer);
        game.undoMove(col);

        if (score < bestScore) {
          bestScore = score;
          bestCol = col;
        }
        beta = Math.min(beta, bestScore);
        if (alpha >= beta) {
          break; // Alpha cutoff (Alpha-Beta pruning)
        }
      }
    }

    // Store in Transposition Table
    let flag = FLAG_EXACT;
    if (bestScore <= initialAlpha) {
      flag = FLAG_UPPERBOUND;
    } else if (bestScore >= beta) {
      flag = FLAG_LOWERBOUND;
    }

    if (this.transpositionTable.size < 500000) {
      this.transpositionTable.set(key, {
        depth,
        score: bestScore,
        flag,
        bestCol
      });
    }

    return bestScore;
  }

  /**
   * Find the optimal move for the AI
   */
  getBestMove(game, options = {}) {
    const startTime = performance.now();
    const searchDepth = options.depth || this.maxDepth;
    const aiPlayer = options.aiPlayer || PLAYER_AI;
    const humanPlayer = options.humanPlayer || (aiPlayer === PLAYER_AI ? PLAYER_HUMAN : PLAYER_AI);

    this.stats = {
      nodesEvaluated: 0,
      transpositionHits: 0,
      searchTimeMs: 0,
      maxDepthReached: searchDepth,
      columnScores: {},
      bestColumn: -1
    };

    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) return null;
    if (validMoves.length === 1) {
      this.stats.bestColumn = validMoves[0];
      this.stats.columnScores[validMoves[0]] = 0;
      return validMoves[0];
    }

    // 1. TACTICAL SHORTCUT: Check for immediate winning move
    const winningMove = this.findTacticalMove(game, aiPlayer);
    if (winningMove !== null) {
      this.stats.nodesEvaluated = 1;
      this.stats.searchTimeMs = Math.round(performance.now() - startTime);
      this.stats.bestColumn = winningMove;
      this.stats.columnScores[winningMove] = 1000000;
      return winningMove;
    }

    // 2. TACTICAL SHORTCUT: Check for immediate opponent winning move to block
    const blockingMove = this.findTacticalMove(game, humanPlayer);
    if (blockingMove !== null) {
      this.stats.nodesEvaluated = 2;
      this.stats.searchTimeMs = Math.round(performance.now() - startTime);
      this.stats.bestColumn = blockingMove;
      this.stats.columnScores[blockingMove] = 900000;
      return blockingMove;
    }

    // 3. FULL MINIMAX SEARCH
    let bestScore = -Infinity;
    let bestMoves = [];
    let alpha = -Infinity;
    const beta = Infinity;

    for (const col of validMoves) {
      game.makeMove(col, aiPlayer);
      const score = this.minimax(game, searchDepth - 1, alpha, beta, false, aiPlayer, humanPlayer);
      game.undoMove(col);

      this.stats.columnScores[col] = score;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [col];
      } else if (score === bestScore) {
        bestMoves.push(col);
      }
      alpha = Math.max(alpha, bestScore);
    }

    // Tie-breaker: prefer center-most column among equal scores
    bestMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));
    const chosenCol = bestMoves[0];

    this.stats.bestColumn = chosenCol;
    this.stats.searchTimeMs = Number((performance.now() - startTime).toFixed(1));

    return chosenCol;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MinimaxBot,
    COLUMN_WEIGHTS,
    MOVE_EXPLORATION_ORDER
  };
} else if (typeof window !== 'undefined') {
  window.MinimaxBot = MinimaxBot;
  window.COLUMN_WEIGHTS = COLUMN_WEIGHTS;
  window.MOVE_EXPLORATION_ORDER = MOVE_EXPLORATION_ORDER;
}
