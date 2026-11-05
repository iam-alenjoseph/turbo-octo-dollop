/**
 * Production Connect Four Controller & Web Application Logic
 * Integrates Bitboard Engine, Web Workers, Audio Synthesis, 
 * Tactical Explanation Engine, and Interactive Puzzles.
 */

// Synthesized Sound FX using Web Audio API (Zero external assets)
class SoundFX {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playDrop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = this.ctx.currentTime + idx * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.35);
    });
  }

  playLose() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [350, 310, 260, 195];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = this.ctx.currentTime + idx * 0.14;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.22, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }
}

// App Controller State
const state = {
  board: new Bitboard(),
  engine: new Engine({ depth: 8 }),
  worker: null,
  isWorkerReady: false,
  currentTurn: PLAYER_HUMAN, // 1 = Human, 2 = AI
  depth: 8,
  starter: 'human', // 'human' or 'ai'
  mode: 'vs-ai', // 'vs-ai' or 'ai-vs-ai'
  isThinking: false,
  spectatorTimeout: null,
  activePuzzle: null,
  sound: new SoundFX()
};

// DOM Elements
const boardGrid = document.getElementById('boardGrid');
const previewRow = document.getElementById('previewRow');
const statusMessage = document.getElementById('statusMessage');
const turnIndicator = document.getElementById('turnIndicator');
const moveBadge = document.getElementById('moveBadge');
const statNodes = document.getElementById('statNodes');
const statTime = document.getElementById('statTime');
const statNps = document.getElementById('statNps');
const statHits = document.getElementById('statHits');
const depthRatio = document.getElementById('depthRatio');
const depthBar = document.getElementById('depthBar');
const moveLog = document.getElementById('moveLog');
const evalBarFill = document.getElementById('evalBarFill');
const evalScoreText = document.getElementById('evalScoreText');
const columnHints = document.getElementById('columnHints');
const tacticalExplanation = document.getElementById('tacticalExplanation');
const tacticalTag = document.getElementById('tacticalTag');
const pvTrail = document.getElementById('pvTrail');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const puzzlesBtn = document.getElementById('puzzlesBtn');
const puzzlesModal = document.getElementById('puzzlesModal');
const puzzlesCloseBtn = document.getElementById('puzzlesCloseBtn');
const puzzleList = document.getElementById('puzzleList');
const portfolioBtn = document.getElementById('portfolioBtn');
const portfolioModal = document.getElementById('portfolioModal');
const portfolioCloseBtn = document.getElementById('portfolioCloseBtn');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');
const solveBtn = document.getElementById('solveBtn');

// Initialize Web Worker with graceful fallback
function initWorker() {
  if (window.Worker && window.location.protocol !== 'file:') {
    try {
      state.worker = new Worker('worker.js');
      state.worker.postMessage({ action: 'init', options: { depth: state.depth } });
      state.worker.onmessage = function (e) {
        const data = e.data;
        if (data.type === 'ready') {
          state.isWorkerReady = true;
        } else if (data.type === 'result') {
          handleEngineResult(data.bestMove, data.stats);
        }
      };
      state.worker.onerror = function (err) {
        console.warn('Worker initialization fallback to synchronous engine:', err);
        state.worker = null;
        state.isWorkerReady = false;
      };
    } catch (e) {
      console.warn('Worker fallback:', e);
      state.worker = null;
      state.isWorkerReady = false;
    }
  }
}

// Generate 7x6 DOM Cells
function createBoardDOM() {
  boardGrid.innerHTML = '';
  for (let r = ROWS - 1; r >= 0; r--) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => handleColumnClick(c));
      cell.addEventListener('mouseenter', () => updatePreview(c));
      boardGrid.appendChild(cell);
    }
  }

  for (let c = 0; c < COLS; c++) {
    const slot = previewRow.children[c];
    slot.addEventListener('click', () => handleColumnClick(c));
    slot.addEventListener('mouseenter', () => updatePreview(c));
  }
}

// Ghost Hover Disc
function updatePreview(col) {
  if (state.board.isWinForLastPlayer() || state.board.isBoardFull() || state.isThinking) return;
  if (state.mode === 'vs-ai' && state.currentTurn === PLAYER_AI) return;

  for (let c = 0; c < COLS; c++) {
    const slot = previewRow.children[c];
    const disc = slot.querySelector('.preview-disc');
    if (c === col && state.board.isValidMove(col)) {
      disc.style.opacity = '0.8';
      disc.style.background = (state.currentTurn === PLAYER_HUMAN) ? 'var(--red)' : 'var(--yellow)';
      disc.style.boxShadow = (state.currentTurn === PLAYER_HUMAN) ? '0 0 16px var(--red-glow)' : '0 0 16px var(--yellow-glow)';
    } else {
      disc.style.opacity = '0';
    }
  }
}

previewRow.addEventListener('mouseleave', () => {
  for (let c = 0; c < COLS; c++) {
    previewRow.children[c].querySelector('.preview-disc').style.opacity = '0';
  }
});

// Board Rendering
function renderBoard() {
  const grid = state.board.toArray2D(state.starter === 'human');
  const isGameOver = state.board.isWinForLastPlayer() || state.board.isBoardFull();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = boardGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      const piece = grid[r][c];
      cell.className = 'cell';
      cell.innerHTML = '';

      if (piece !== EMPTY) {
        const disc = document.createElement('div');
        disc.className = `disc ${piece === PLAYER_HUMAN ? 'human' : 'ai'}`;
        // Animate last placed move
        if (state.board.history.length > 0 && 
            state.board.history[state.board.history.length - 1] === c &&
            r === (state.board.history.filter(col => col === c).length - 1)) {
          disc.classList.add('falling');
        }
        cell.appendChild(disc);
      }
    }
  }

  // Highlight winning cells if won
  if (state.board.isWinForLastPlayer()) {
    highlightWinningDiscs(grid);
  }

  // Update Status Display
  moveBadge.textContent = `Move: #${state.board.moves}`;

  if (state.board.isWinForLastPlayer()) {
    // Winner is whoever made the last move
    const lastPlayer = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
    if (lastPlayer === PLAYER_HUMAN) {
      statusMessage.textContent = '🎉 You defeated the AI!';
      turnIndicator.className = 'turn-indicator-disc';
      turnIndicator.style.background = 'var(--green)';
      state.sound.playWin();
    } else {
      statusMessage.textContent = '💀 AI Bot Wins!';
      turnIndicator.className = 'turn-indicator-disc ai';
      state.sound.playLose();
    }
  } else if (state.board.isBoardFull()) {
    statusMessage.textContent = '🤝 Game Drawn!';
    turnIndicator.className = 'turn-indicator-disc';
    turnIndicator.style.background = 'var(--text-muted)';
  } else {
    if (state.currentTurn === PLAYER_HUMAN) {
      statusMessage.textContent = 'Your Turn (Red)';
      turnIndicator.className = 'turn-indicator-disc';
      turnIndicator.style.background = 'var(--red)';
    } else {
      statusMessage.textContent = state.isThinking ? 'AI is calculating move...' : 'AI Turn (Yellow)';
      turnIndicator.className = 'turn-indicator-disc ai';
      turnIndicator.style.background = 'var(--yellow)';
    }
  }
}

// Find and highlight winning 4-in-a-row
function highlightWinningDiscs(grid) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = grid[r][c];
      if (p === EMPTY) continue;

      for (const [dr, dc] of directions) {
        const streak = [];
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === p) {
            streak.push([nr, nc]);
          } else {
            break;
          }
        }
        if (streak.length === 4) {
          for (const [wr, wc] of streak) {
            const cell = boardGrid.querySelector(`[data-row="${wr}"][data-col="${wc}"]`);
            if (cell) cell.classList.add('winning');
          }
          return;
        }
      }
    }
  }
}

// Move History
function logMove(player, col) {
  const isHuman = player === PLAYER_HUMAN;
  if (state.board.moves === 1) {
    moveLog.innerHTML = '';
  }
  const div = document.createElement('div');
  div.className = 'move-log-entry';
  div.innerHTML = `
    <span>#${state.board.moves} ${isHuman ? '<b class="log-human">Human (Red)</b>' : '<b class="log-ai">AI Bot (Yellow)</b>'}</span>
    <span>Column ${col}</span>
  `;
  moveLog.appendChild(div);
  moveLog.scrollTop = moveLog.scrollHeight;
}

// Update Advantage Bar & Real-time Column Pills
function updateEvaluationVisuals(stats) {
  const scores = stats.columnScores || {};
  let bestScore = -Infinity;
  let bestCol = -1;

  for (let c = 0; c < COLS; c++) {
    const hint = columnHints.children[c];
    if (scores[c] !== undefined) {
      const s = scores[c];
      let displayScore = s;
      if (s > 900000) displayScore = '+M';
      else if (s < -900000) displayScore = '-M';
      hint.textContent = `c${c}: ${displayScore}`;

      if (s > bestScore) {
        bestScore = s;
        bestCol = c;
      }
    } else {
      hint.textContent = `c${c}`;
    }
    hint.classList.remove('best');
  }

  if (bestCol !== -1 && columnHints.children[bestCol]) {
    columnHints.children[bestCol].classList.add('best');
  }

  // Sigmoid-based win probability
  let winProb = 50;
  if (bestScore > 900000) winProb = 100;
  else if (bestScore < -900000) winProb = 0;
  else if (isFinite(bestScore)) {
    // Sigmoid curve: P = 1 / (1 + 10^(-score / 80))
    winProb = (1 / (1 + Math.pow(10, -bestScore / 80))) * 100;
    winProb = Math.max(2, Math.min(98, winProb));
  }

  evalScoreText.textContent = `${winProb.toFixed(1)}%`;
  evalBarFill.style.width = `${winProb}%`;
}

// Update Telemetry Panel
function updateTelemetry(stats) {
  statNodes.textContent = (stats.nodesEvaluated || 0).toLocaleString();
  statTime.textContent = `${stats.searchTimeMs || 0} ms`;
  statNps.textContent = `${(stats.nodesPerSec || 0).toLocaleString()} nps`;
  statHits.textContent = (stats.transpositionHits || 0).toLocaleString();

  depthRatio.textContent = `${stats.maxDepthReached || state.depth} / ${state.depth} ply`;
  depthBar.style.width = `${((stats.maxDepthReached || state.depth) / 8) * 100}%`;

  // Update Reasoning & Principal Variation Trail
  if (stats.explanation) {
    tacticalExplanation.textContent = stats.explanation;
    tacticalTag.textContent = stats.searchTimeMs < 2 ? 'BOOK MOVE' : 'SOLVED';
  }

  if (stats.pvLine && stats.pvLine.length > 0) {
    pvTrail.innerHTML = '';
    stats.pvLine.forEach((col, idx) => {
      const pill = document.createElement('span');
      pill.className = 'pv-pill';
      pill.textContent = `Ply ${idx + 1}: Col ${col}`;
      pvTrail.appendChild(pill);
    });
  }
}

// User Move Click
function handleColumnClick(col) {
  if (state.board.isWinForLastPlayer() || state.board.isBoardFull() || state.isThinking) return;
  if (state.mode === 'vs-ai' && state.currentTurn !== PLAYER_HUMAN) return;
  if (!state.board.isValidMove(col)) return;

  // Check if puzzle is active and user solved it
  if (state.activePuzzle) {
    if (col === state.activePuzzle.solution) {
      tacticalExplanation.textContent = `🎯 Excellent! Column ${col} is the optimal tactical solution!`;
      tacticalTag.textContent = 'SOLVED';
    } else {
      tacticalExplanation.textContent = `❌ Inaccurate move. Solution hint: ${state.activePuzzle.hint}`;
      tacticalTag.textContent = 'INCORRECT';
    }
  }

  state.board.makeMove(col);
  state.sound.playDrop();
  logMove(state.currentTurn, col);

  state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
  renderBoard();

  if (!state.board.isWinForLastPlayer() && !state.board.isBoardFull()) {
    if (state.mode === 'vs-ai' && state.currentTurn === PLAYER_AI) {
      triggerAIMove();
    }
  }
}

// Trigger AI Calculation
function triggerAIMove() {
  state.isThinking = true;
  renderBoard();

  if (state.isWorkerReady && state.worker) {
    state.worker.postMessage({
      action: 'search',
      moves: state.board.history,
      depth: state.depth
    });
  } else {
    // Asynchronous setTimeout fallback
    setTimeout(() => {
      const bestMove = state.engine.search(state.board, { depth: state.depth });
      handleEngineResult(bestMove, state.engine.stats);
    }, 30);
  }
}

// Handle Engine Results (from worker or synchronous)
function handleEngineResult(bestMove, stats) {
  state.isThinking = false;

  if (bestMove !== null && bestMove !== -1 && state.board.isValidMove(bestMove)) {
    state.board.makeMove(bestMove);
    state.sound.playDrop();
    logMove(state.currentTurn, bestMove);

    updateTelemetry(stats);
    updateEvaluationVisuals(stats);

    state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
    renderBoard();

    if (!state.board.isWinForLastPlayer() && !state.board.isBoardFull() && state.mode === 'ai-vs-ai') {
      state.spectatorTimeout = setTimeout(triggerAIMove, 600);
    }
  }
}

// Reset Game
function resetGame() {
  if (state.spectatorTimeout) {
    clearTimeout(state.spectatorTimeout);
    state.spectatorTimeout = null;
  }

  state.board.reset();
  state.engine.clearMemory();
  state.activePuzzle = null;
  state.isThinking = false;
  state.currentTurn = (state.starter === 'human') ? PLAYER_HUMAN : PLAYER_AI;

  statNodes.textContent = '0';
  statTime.textContent = '0 ms';
  statNps.textContent = '0 nps';
  statHits.textContent = '0';
  evalScoreText.textContent = '50.0%';
  evalBarFill.style.width = '50%';
  tacticalExplanation.textContent = 'Awaiting opening move. Column 3 offers mathematical center-axis dominance.';
  tacticalTag.textContent = 'READY';
  pvTrail.innerHTML = '<span style="color: var(--text-dim); font-size: 0.75rem;">None calculated yet.</span>';
  moveLog.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 15px 0;">Awaiting first move...</div>';

  for (let c = 0; c < COLS; c++) {
    columnHints.children[c].textContent = `c${c}`;
    columnHints.children[c].classList.remove('best');
  }

  renderBoard();

  if (state.currentTurn === PLAYER_AI || state.mode === 'ai-vs-ai') {
    triggerAIMove();
  }
}

// Undo Move
function handleUndo() {
  if (state.isThinking || state.board.history.length === 0) return;

  if (state.mode === 'vs-ai') {
    if (state.board.history.length >= 2) {
      state.board.undoMove();
      state.board.undoMove();
      state.currentTurn = PLAYER_HUMAN;
    } else {
      state.board.undoMove();
      state.currentTurn = (state.starter === 'human') ? PLAYER_HUMAN : PLAYER_AI;
    }
  } else {
    state.board.undoMove();
    state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
  }

  state.sound.playClick();
  renderBoard();
}

// Populate Puzzles in Modal
function populatePuzzles() {
  puzzleList.innerHTML = '';
  if (!window.PUZZLES) return;

  window.PUZZLES.forEach((p, idx) => {
    const item = document.createElement('div');
    item.className = 'puzzle-item';
    
    let badgeClass = 'badge-medium';
    if (p.difficulty === 'Essential') badgeClass = 'badge-easy';
    else if (p.difficulty === 'Advanced') badgeClass = 'badge-hard';
    else if (p.difficulty === 'Master' || p.difficulty === 'Grandmaster') badgeClass = 'badge-master';

    item.innerHTML = `
      <div class="puzzle-info">
        <h4>${idx + 1}. ${p.title}</h4>
        <p>${p.description}</p>
      </div>
      <span class="puzzle-badge ${badgeClass}">${p.difficulty}</span>
    `;

    item.addEventListener('click', () => {
      loadPuzzle(p);
      puzzlesModal.classList.remove('active');
    });

    puzzleList.appendChild(item);
  });
}

// Load a specific puzzle
function loadPuzzle(puzzle) {
  resetGame();
  state.activePuzzle = puzzle;
  state.starter = puzzle.starter;
  state.currentTurn = (puzzle.targetPlayer === PLAYER_HUMAN) ? PLAYER_HUMAN : PLAYER_AI;

  // Apply move sequence
  for (const m of puzzle.moves) {
    state.board.makeMove(m);
  }

  tacticalExplanation.textContent = `Challenge Loaded: ${puzzle.title}. ${puzzle.hint}`;
  tacticalTag.textContent = 'PUZZLE';
  renderBoard();
}

// Setup Event Listeners
function setupListeners() {
  // Difficulty Selection
  const diffButtons = document.querySelectorAll('#difficultyGroup button');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      diffButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.depth = parseInt(btn.dataset.depth, 10);
      state.engine.setDepth(state.depth);
      updateTelemetry({ maxDepthReached: state.depth });
      state.sound.playClick();
    });
  });

  // Starter Selection
  const starterButtons = document.querySelectorAll('#starterGroup button');
  starterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      starterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.starter = btn.dataset.starter;
      state.sound.playClick();
      resetGame();
    });
  });

  // Operating Mode Selection
  const modeButtons = document.querySelectorAll('#modeGroup button');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      state.sound.playClick();
      resetGame();
    });
  });

  // Action Buttons
  newGameBtn.addEventListener('click', () => {
    state.sound.playClick();
    resetGame();
  });

  undoBtn.addEventListener('click', handleUndo);

  solveBtn.addEventListener('click', () => {
    if (state.isThinking || state.board.isWinForLastPlayer() || state.board.isBoardFull()) return;
    triggerAIMove();
  });

  soundToggleBtn.addEventListener('click', () => {
    state.sound.enabled = !state.sound.enabled;
    soundToggleBtn.textContent = state.sound.enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    state.sound.playClick();
  });

  // Modals
  puzzlesBtn.addEventListener('click', () => puzzlesModal.classList.add('active'));
  puzzlesCloseBtn.addEventListener('click', () => puzzlesModal.classList.remove('active'));
  puzzlesModal.addEventListener('click', (e) => {
    if (e.target === puzzlesModal) puzzlesModal.classList.remove('active');
  });

  portfolioBtn.addEventListener('click', () => portfolioModal.classList.add('active'));
  portfolioCloseBtn.addEventListener('click', () => portfolioModal.classList.remove('active'));
  portfolioModal.addEventListener('click', (e) => {
    if (e.target === portfolioModal) portfolioModal.classList.remove('active');
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (puzzlesModal.classList.contains('active') || portfolioModal.classList.contains('active')) return;
    const key = e.key;
    if (key >= '1' && key <= '7') {
      handleColumnClick(parseInt(key, 10) - 1);
    } else if (key >= '0' && key <= '6') {
      handleColumnClick(parseInt(key, 10));
    }
  });
}

// Initial Boot
createBoardDOM();
populatePuzzles();
setupListeners();
initWorker();
resetGame();
