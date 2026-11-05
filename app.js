/**
 * Connect Four Web Application Logic
 * Integrates Connect4 Game Rules, Minimax Engine, UI Animations, and Web Audio.
 */

// Sound FX Synthesizer using Web Audio API (Zero external assets required)
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

    gain.gain.setValueAtTime(0.4, now);
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

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
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

      gain.gain.setValueAtTime(0.25, time);
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
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }
}

// App Controller State
const state = {
  game: new Connect4(),
  bot: new MinimaxBot({ depth: 7 }),
  currentTurn: PLAYER_HUMAN, // 1 = Human, 2 = AI
  depth: 7,
  starter: 'human', // 'human' or 'ai'
  mode: 'vs-ai', // 'vs-ai' or 'ai-vs-ai'
  isThinking: false,
  spectatorTimeout: null,
  history: [], // Stack of columns played
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
const statDepth = document.getElementById('statDepth');
const statHits = document.getElementById('statHits');
const depthRatio = document.getElementById('depthRatio');
const depthBar = document.getElementById('depthBar');
const moveLog = document.getElementById('moveLog');
const evalBarFill = document.getElementById('evalBarFill');
const evalScoreText = document.getElementById('evalScoreText');
const columnHints = document.getElementById('columnHints');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const guideModal = document.getElementById('guideModal');
const guideBtn = document.getElementById('guideBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');

// Initialize 7x6 Board Cells
function createBoardDOM() {
  boardGrid.innerHTML = '';
  // Row 5 at top down to Row 0 at bottom
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

  // Preview row column listeners
  for (let c = 0; c < COLS; c++) {
    const slot = previewRow.children[c];
    slot.addEventListener('click', () => handleColumnClick(c));
    slot.addEventListener('mouseenter', () => updatePreview(c));
  }
}

// Update ghost hover disc
function updatePreview(col) {
  if (state.game.gameOver || state.isThinking || (state.mode === 'vs-ai' && state.currentTurn === PLAYER_AI)) {
    return;
  }
  for (let c = 0; c < COLS; c++) {
    const slot = previewRow.children[c];
    const disc = slot.querySelector('.preview-disc');
    if (c === col && state.game.isValidMove(col)) {
      disc.style.opacity = '0.75';
      disc.style.background = (state.currentTurn === PLAYER_HUMAN) ? 'var(--red)' : 'var(--yellow)';
      disc.style.boxShadow = (state.currentTurn === PLAYER_HUMAN) ? '0 0 15px var(--red-glow)' : '0 0 15px var(--yellow-glow)';
    } else {
      disc.style.opacity = '0';
    }
  }
}

// Clear preview
previewRow.addEventListener('mouseleave', () => {
  for (let c = 0; c < COLS; c++) {
    previewRow.children[c].querySelector('.preview-disc').style.opacity = '0';
  }
});

// Update DOM after move
function renderBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = boardGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      const piece = state.game.board[r][c];
      cell.className = 'cell';
      cell.innerHTML = '';

      if (piece !== EMPTY) {
        const disc = document.createElement('div');
        disc.className = `disc ${piece === PLAYER_HUMAN ? 'human' : 'ai'}`;
        // If this is the last move, animate drop
        if (state.game.lastMove && state.game.lastMove.row === r && state.game.lastMove.col === c) {
          disc.classList.add('falling');
        }
        cell.appendChild(disc);
      }
    }
  }

  // Highlight winning cells
  if (state.game.winningCells) {
    for (const [r, c] of state.game.winningCells) {
      const cell = boardGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
      if (cell) {
        cell.classList.add('winning');
      }
    }
  }

  // Update status message
  moveBadge.textContent = `Move: #${state.game.movesCount}`;

  if (state.game.gameOver) {
    if (state.game.winner === PLAYER_HUMAN) {
      statusMessage.textContent = '🎉 You defeated the AI!';
      turnIndicator.className = 'turn-indicator-disc';
      turnIndicator.style.background = 'var(--green)';
      state.sound.playWin();
    } else if (state.game.winner === PLAYER_AI) {
      statusMessage.textContent = '💀 AI Bot Wins!';
      turnIndicator.className = 'turn-indicator-disc ai';
      state.sound.playLose();
    } else {
      statusMessage.textContent = '🤝 Game Drawn!';
      turnIndicator.className = 'turn-indicator-disc';
      turnIndicator.style.background = 'var(--text-muted)';
    }
  } else {
    if (state.currentTurn === PLAYER_HUMAN) {
      statusMessage.textContent = 'Your Turn (Red)';
      turnIndicator.className = 'turn-indicator-disc';
    } else {
      statusMessage.textContent = state.isThinking ? 'AI is computing best move...' : 'AI Turn (Yellow)';
      turnIndicator.className = 'turn-indicator-disc ai';
    }
  }
}

// Append entry to Move History
function logMove(player, col) {
  const isHuman = player === PLAYER_HUMAN;
  if (state.game.movesCount === 1) {
    moveLog.innerHTML = '';
  }
  const div = document.createElement('div');
  div.className = 'move-log-entry';
  div.innerHTML = `
    <span>#${state.game.movesCount} ${isHuman ? '<b class="log-human">Human (Red)</b>' : '<b class="log-ai">AI Bot (Yellow)</b>'}</span>
    <span>Column ${col}</span>
  `;
  moveLog.appendChild(div);
  moveLog.scrollTop = moveLog.scrollHeight;
}

// Update evaluation bar & column score indicators
function updateEvaluationVisuals() {
  const scores = state.bot.stats.columnScores || {};
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

  // Update Advantage Gauge
  // Range from -100 to +100 normalized to 0% - 100%
  let evalValue = 0;
  if (bestScore > 900000) evalValue = 100;
  else if (bestScore < -900000) evalValue = -100;
  else if (isFinite(bestScore)) {
    evalValue = Math.max(-100, Math.min(100, bestScore / 1.5));
  }

  evalScoreText.textContent = (evalValue > 0 ? '+' : '') + evalValue.toFixed(1);
  const fillPercent = 50 + (evalValue / 2);
  evalBarFill.style.width = `${Math.max(5, Math.min(95, fillPercent))}%`;
}

// Update Telemetry Panel
function updateTelemetry(stats) {
  statNodes.textContent = (stats.nodesEvaluated || 0).toLocaleString();
  statTime.textContent = `${stats.searchTimeMs || 0} ms`;
  statDepth.textContent = `${stats.maxDepthReached || state.depth} ply`;
  statHits.textContent = (stats.transpositionHits || 0).toLocaleString();

  depthRatio.textContent = `${state.depth} / 8`;
  depthBar.style.width = `${(state.depth / 8) * 100}%`;
}

// User Move Execution
function handleColumnClick(col) {
  if (state.game.gameOver || state.isThinking) return;
  if (state.mode === 'vs-ai' && state.currentTurn !== PLAYER_HUMAN) return;
  if (!state.game.isValidMove(col)) return;

  const row = state.game.makeMove(col, state.currentTurn);
  if (row === -1) return;

  state.history.push(col);
  state.sound.playDrop();
  logMove(state.currentTurn, col);

  state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
  renderBoard();

  if (!state.game.gameOver) {
    if (state.mode === 'vs-ai' && state.currentTurn === PLAYER_AI) {
      triggerAIMove();
    }
  }
}

// Trigger AI Calculation Asynchronously
function triggerAIMove() {
  state.isThinking = true;
  renderBoard();

  // Allow UI thread to repaint "Thinking..." indicator before blocking search
  setTimeout(() => {
    const chosenCol = state.bot.getBestMove(state.game, {
      depth: state.depth,
      aiPlayer: state.currentTurn
    });

    state.isThinking = false;

    if (chosenCol !== null && chosenCol !== -1) {
      state.game.makeMove(chosenCol, state.currentTurn);
      state.history.push(chosenCol);
      state.sound.playDrop();
      logMove(state.currentTurn, chosenCol);

      updateTelemetry(state.bot.stats);
      updateEvaluationVisuals();

      state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
      renderBoard();

      if (!state.game.gameOver && state.mode === 'ai-vs-ai') {
        state.spectatorTimeout = setTimeout(triggerAIMove, 650);
      }
    }
  }, 40);
}

// Reset Game
function resetGame() {
  if (state.spectatorTimeout) {
    clearTimeout(state.spectatorTimeout);
    state.spectatorTimeout = null;
  }

  state.game.reset();
  state.bot.clearTranspositionTable();
  state.history = [];
  state.isThinking = false;
  state.currentTurn = (state.starter === 'human') ? PLAYER_HUMAN : PLAYER_AI;

  statNodes.textContent = '0';
  statTime.textContent = '0 ms';
  statHits.textContent = '0';
  evalScoreText.textContent = '0.00';
  evalBarFill.style.width = '50%';
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
  if (state.game.gameOver || state.isThinking || state.history.length === 0) return;

  if (state.mode === 'vs-ai') {
    // Undo both AI move and Human move
    if (state.history.length >= 2) {
      const aiCol = state.history.pop();
      state.game.undoMove(aiCol);
      const humanCol = state.history.pop();
      state.game.undoMove(humanCol);
      state.currentTurn = PLAYER_HUMAN;
    } else if (state.history.length === 1) {
      const col = state.history.pop();
      state.game.undoMove(col);
      state.currentTurn = (state.starter === 'human') ? PLAYER_HUMAN : PLAYER_AI;
    }
  } else {
    const col = state.history.pop();
    state.game.undoMove(col);
    state.currentTurn = (state.currentTurn === PLAYER_HUMAN) ? PLAYER_AI : PLAYER_HUMAN;
  }

  state.sound.playClick();
  renderBoard();
}

// Setup Event Listeners
function setupListeners() {
  // Difficulty buttons
  const diffButtons = document.querySelectorAll('#difficultyGroup button');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      diffButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.depth = parseInt(btn.dataset.depth, 10);
      state.bot.setDepth(state.depth);
      updateTelemetry({ maxDepthReached: state.depth });
      state.sound.playClick();
    });
  });

  // Starter buttons
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

  // Game Mode buttons
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

  soundToggleBtn.addEventListener('click', () => {
    state.sound.enabled = !state.sound.enabled;
    soundToggleBtn.textContent = state.sound.enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    state.sound.playClick();
  });

  // Guide Modal
  guideBtn.addEventListener('click', () => {
    guideModal.classList.add('active');
  });

  modalCloseBtn.addEventListener('click', () => {
    guideModal.classList.remove('active');
  });

  guideModal.addEventListener('click', (e) => {
    if (e.target === guideModal) {
      guideModal.classList.remove('active');
    }
  });

  // Keyboard controls: 1-7 or 0-6 to drop pieces
  window.addEventListener('keydown', (e) => {
    if (guideModal.classList.contains('active')) return;
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
setupListeners();
resetGame();
