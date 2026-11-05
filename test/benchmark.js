/**
 * Connect Four Minimax Performance Benchmark & Validation
 */

const { Connect4, PLAYER_HUMAN, PLAYER_AI } = require('../src/connect4');
const { MinimaxBot } = require('../src/minimax');

console.log('==================================================');
console.log('       MINIMAX ENGINE PERFORMANCE BENCHMARK       ');
console.log('==================================================\n');

const depths = [3, 4, 5, 6, 7, 8];

for (const depth of depths) {
  const game = new Connect4();
  const bot = new MinimaxBot({ depth });

  // Play 2 standard opening moves to simulate mid-game branching
  game.makeMove(3, PLAYER_HUMAN);
  game.makeMove(3, PLAYER_AI);
  game.makeMove(2, PLAYER_HUMAN);

  const start = performance.now();
  const move = bot.getBestMove(game);
  const timeMs = Number((performance.now() - start).toFixed(1));
  const nodes = bot.stats.nodesEvaluated;
  const hits = bot.stats.transpositionHits;
  const nps = timeMs > 0 ? Math.round((nodes / (timeMs / 1000))) : nodes;

  console.log(`[Depth ${depth}]`);
  console.log(`  Chosen Column      : ${move}`);
  console.log(`  Nodes Evaluated    : ${nodes.toLocaleString()}`);
  console.log(`  Transposition Hits : ${hits.toLocaleString()}`);
  console.log(`  Search Time        : ${timeMs} ms`);
  console.log(`  Nodes / Second     : ${nps.toLocaleString()} nps`);
  console.log(`  Column Scores      : ${JSON.stringify(bot.stats.columnScores)}`);
  console.log('--------------------------------------------------');
}

console.log('\nTesting tactical puzzles:');

// Test 1: Immediate win
const puzzle1 = new Connect4();
puzzle1.makeMove(3, PLAYER_AI);
puzzle1.makeMove(0, PLAYER_HUMAN);
puzzle1.makeMove(3, PLAYER_AI);
puzzle1.makeMove(0, PLAYER_HUMAN);
puzzle1.makeMove(3, PLAYER_AI);
puzzle1.makeMove(1, PLAYER_HUMAN);
// AI has 3 vertical in column 3. Should immediately play col 3.
const bot1 = new MinimaxBot({ depth: 5 });
const move1 = bot1.getBestMove(puzzle1);
console.log(`Puzzle 1 (AI vertical win at col 3): ${move1 === 3 ? '✅ PASSED' : '❌ FAILED'} (Chose: ${move1})`);

// Test 2: Immediate defense
const puzzle2 = new Connect4();
puzzle2.makeMove(2, PLAYER_HUMAN);
puzzle2.makeMove(6, PLAYER_AI);
puzzle2.makeMove(3, PLAYER_HUMAN);
puzzle2.makeMove(6, PLAYER_AI);
puzzle2.makeMove(4, PLAYER_HUMAN);
// Human has 2, 3, 4 horizontally. AI MUST block at 1 or 5.
const bot2 = new MinimaxBot({ depth: 5 });
const move2 = bot2.getBestMove(puzzle2);
console.log(`Puzzle 2 (Block human horizontal threat at 1 or 5): ${(move2 === 1 || move2 === 5) ? '✅ PASSED' : '❌ FAILED'} (Chose: ${move2})`);

console.log('\nAll benchmarks completed successfully!');
