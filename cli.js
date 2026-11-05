#!/usr/bin/env node

/**
 * Interactive Connect Four CLI
 * Powered by 64-Bit Bitboard Negamax Engine with PVS & Move Explanations.
 */

const readline = require('readline');
const { Bitboard, ROWS, COLS, PLAYER_HUMAN, PLAYER_AI } = require('./src/bitboard');
const { Engine } = require('./src/engine');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

function renderBoard(board, humanFirst) {
  const grid = board.toArray2D(humanFirst);

  console.log('\n  ' + BOLD + CYAN + ' 0   1   2   3   4   5   6 ' + RESET);
  console.log(' ' + BLUE + '┌───┬───┬───┬───┬───┬───┬───┐' + RESET);

  for (let r = ROWS - 1; r >= 0; r--) {
    let rowStr = ' ' + BLUE + '│' + RESET;
    for (let c = 0; c < COLS; c++) {
      const piece = grid[r][c];
      let char = '   ';
      if (piece === PLAYER_HUMAN) {
        char = RED + ' ● ' + RESET;
      } else if (piece === PLAYER_AI) {
        char = YELLOW + ' ⬤ ' + RESET;
      }
      rowStr += char + BLUE + '│' + RESET;
    }
    console.log(rowStr);
    if (r > 0) {
      console.log(' ' + BLUE + '├───┼───┼───┼───┼───┼───┼───┤' + RESET);
    }
  }
  console.log(' ' + BLUE + '└───┴───┴───┴───┴───┴───┴───┘' + RESET);
  console.log('  ' + BOLD + CYAN + ' 0   1   2   3   4   5   6 ' + RESET + '\n');
}

async function main() {
  console.clear();
  console.log(BOLD + MAGENTA + '===================================================' + RESET);
  console.log(BOLD + CYAN + '       CONNECT FOUR — NEGAMAX BITBOARD AI          ' + RESET);
  console.log(BOLD + MAGENTA + '===================================================' + RESET);
  console.log(GRAY + '64-Bit Bitboard • Principal Variation Search • Zobrist Cache\n' + RESET);

  console.log(`Select AI Difficulty / Search Depth:`);
  console.log(`  1) Casual       [Depth 3] - Fast, basic tactics`);
  console.log(`  2) Medium       [Depth 5] - Solid strategy`);
  console.log(`  3) Hard         [Depth 7] - Deep traps, highly tactical`);
  console.log(`  4) Grandmaster  [Depth 8] - Near-flawless calculation (Recommended)`);

  let depthChoice = await ask('\nEnter choice (1-4) [default: 4]: ');
  depthChoice = depthChoice.trim();
  let depth = 8;
  if (depthChoice === '1') depth = 3;
  else if (depthChoice === '2') depth = 5;
  else if (depthChoice === '3') depth = 7;

  let firstChoice = await ask('Who goes first? (1 = You [Red], 2 = AI [Yellow]) [default: 1]: ');
  firstChoice = firstChoice.trim();
  const humanFirst = (firstChoice !== '2');
  let currentTurn = humanFirst ? PLAYER_HUMAN : PLAYER_AI;

  const board = new Bitboard();
  const engine = new Engine({ depth });

  console.log(`\nGame initialized! AI Depth: ${depth} ply. Good luck!`);

  while (!board.isWinForLastPlayer() && !board.isBoardFull()) {
    renderBoard(board, humanFirst);

    if (currentTurn === PLAYER_HUMAN) {
      let col = -1;
      while (true) {
        const input = await ask(`Your move (${RED}Red ●${RESET}) — enter column (0-6) or 'q' to quit: `);
        if (input.trim().toLowerCase() === 'q') {
          console.log('\nGame exited.');
          rl.close();
          return;
        }
        col = parseInt(input.trim(), 10);
        if (!isNaN(col) && board.isValidMove(col)) {
          break;
        }
        console.log(RED + 'Invalid column! Please pick an open column between 0 and 6.' + RESET);
      }

      board.makeMove(col);
      currentTurn = PLAYER_AI;
    } else {
      console.log(YELLOW + 'AI is computing optimal line via Negamax PVS...' + RESET);
      const startTime = Date.now();
      const bestCol = engine.search(board, { depth });
      const elapsed = Date.now() - startTime;

      console.log(
        GREEN + `AI played Column ${bestCol}` + RESET +
        GRAY + ` (${engine.stats.nodesEvaluated.toLocaleString()} nodes, ${engine.stats.nodesPerSec.toLocaleString()} nps, ${elapsed}ms)` + RESET
      );
      if (engine.stats.explanation) {
        console.log(CYAN + `💡 Motive: ${engine.stats.explanation}` + RESET);
      }
      if (engine.stats.pvLine && engine.stats.pvLine.length > 1) {
        console.log(GRAY + `🔮 Forecast (PV): ${engine.stats.pvLine.map(c => `Col ${c}`).join(' ➔ ')}` + RESET);
      }

      board.makeMove(bestCol);
      currentTurn = PLAYER_HUMAN;
    }
  }

  renderBoard(board, humanFirst);

  if (board.isWinForLastPlayer()) {
    // Last player made winning move
    const winner = (currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
    if (winner === PLAYER_HUMAN) {
      console.log(BOLD + GREEN + '🎉 CONGRATULATIONS! You defeated the Negamax Engine!' + RESET);
    } else {
      console.log(BOLD + RED + '💀 GAME OVER! The Negamax Engine has defeated you!' + RESET);
    }
  } else {
    console.log(BOLD + YELLOW + '🤝 DRAW! The board is completely full with no winner.' + RESET);
  }

  const playAgain = await ask('\nWould you like to play again? (y/n): ');
  if (playAgain.trim().toLowerCase() === 'y') {
    await main();
  } else {
    console.log('Thanks for playing!');
    rl.close();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    rl.close();
  });
}
