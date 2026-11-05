/**
 * Web Worker for Asynchronous Background Minimax Search
 * Keeps the main browser thread silky smooth at 60/120 FPS.
 */

// Import Bitboard and Engine into Worker
self.importScripts('src/bitboard.js', 'src/engine.js');

let engine = null;

self.onmessage = function (e) {
  const { action, moves, depth, options } = e.data;

  if (action === 'init') {
    engine = new self.Engine(options);
    self.postMessage({ type: 'ready' });
    return;
  }

  if (action === 'search') {
    if (!engine) {
      engine = new self.Engine({ depth: depth || 8 });
    } else if (depth) {
      engine.setDepth(depth);
    }

    // Reconstruct board state from move history
    const board = new self.Bitboard();
    for (const m of moves) {
      board.makeMove(m);
    }

    const startTime = performance.now();
    const bestMove = engine.search(board, { depth });
    const elapsed = performance.now() - startTime;

    self.postMessage({
      type: 'result',
      bestMove,
      stats: engine.stats,
      elapsed
    });
  }

  if (action === 'clear') {
    if (engine) engine.clearMemory();
    self.postMessage({ type: 'cleared' });
  }
};
