#!/usr/bin/env node

/**
 * Interactive Connect Four CLI
 * Play against the Minimax AI directly in your terminal.
 */

const readline = require('readline');
const { Connect4, ROWS, COLS, PLAYER_HUMAN, PLAYER_AI } = require('./src/connect4');
const { MinimaxBot } = require('./src/minimax');

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

function renderBoard(game) {
  console.log('\n  ' + BOLD + CYAN + ' 0   1   2   3   4   5   6 ' + RESET);
  console.log(' ' + BLUE + '┌───┬───┬───┬───┬───┬───┬───┐' + RESET);

  for (let r = ROWS - 1; r >= 0; r--) {
    let rowStr = ' ' + BLUE + '│' + RESET;
    for (let c = 0; c < COLS; c++) {
      const piece = game.board[r][c];
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
  console.log(BOLD + CYAN + '       CONNECT FOUR — INTELLIGENT MINIMAX BOT       ' + RESET);
  console.log(BOLD + MAGENTA + '===================================================' + RESET);
  console.log(GRAY + 'Powered by Minimax with Alpha-Beta Pruning & Transposition Table\n' + RESET);

  console.log(`Select AI Difficulty Level:`);
  console.log(`  1) Casual       [Depth 3] - Fast, basic tactics`);
  console.log(`  2) Medium       [Depth 5] - Strategic play`);
  console.log(`  3) Hard         [Depth 7] - Deep traps, highly tactical (Recommended)`);
  console.log(`  4) Grandmaster  [Depth 8] - Near-flawless calculation`);

  let depthChoice = await ask('\nEnter choice (1-4) [default: 3]: ');
  depthChoice = depthChoice.trim();
  let depth = 7;
  if (depthChoice === '1') depth = 3;
  else if (depthChoice === '2') depth = 5;
  else if (depthChoice === '4') depth = 8;

  let firstChoice = await ask('Who goes first? (1 = You [Red], 2 = AI [Yellow]) [default: 1]: ');
  firstChoice = firstChoice.trim();
  let currentTurn = (firstChoice === '2') ? PLAYER_AI : PLAYER_HUMAN;

  const game = new Connect4();
  const bot = new MinimaxBot({ depth });

  console.log(`\nGame initialized! AI Depth: ${depth}. Good luck, you will need it!`);

  while (!game.gameOver) {
    renderBoard(game);

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
        if (!isNaN(col) && game.isValidMove(col)) {
          break;
        }
        console.log(RED + 'Invalid column! Please pick an open column between 0 and 6.' + RESET);
      }

      game.makeMove(col, PLAYER_HUMAN);
      currentTurn = PLAYER_AI;
    } else {
      console.log(YELLOW + 'AI is computing best move...' + RESET);
      const startTime = Date.now();
      const bestCol = bot.getBestMove(game);
      const elapsed = Date.now() - startTime;

      console.log(
        GREEN + `AI played column ${bestCol}` + RESET +
        GRAY + ` (Evaluated ${bot.stats.nodesEvaluated.toLocaleString()} nodes in ${elapsed}ms, depth: ${depth})` + RESET
      );

      game.makeMove(bestCol, PLAYER_AI);
      currentTurn = PLAYER_HUMAN;
    }
  }

  renderBoard(game);

  if (game.winner === PLAYER_HUMAN) {
    console.log(BOLD + GREEN + '🎉 CONGRATULATIONS! You defeated the Minimax Bot! (Astonishing achievement!)' + RESET);
  } else if (game.winner === PLAYER_AI) {
    console.log(BOLD + RED + '💀 GAME OVER! The Minimax Bot has defeated you!' + RESET);
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
