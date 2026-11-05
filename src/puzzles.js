/**
 * Curated Connect Four Tactical Puzzles & Solved Challenges
 * Highlighting classic game-theoretic patterns:
 *  - Parity traps (Allis's Theorem)
 *  - Double-threat forks
 *  - Zugzwang
 *  - Horizon trap defenses
 */

const PUZZLES = [
  {
    id: "puzzle-1",
    title: "Double Threat (Fork)",
    difficulty: "Intermediate",
    description: "Find the decisive move that sets up two simultaneous winning alignments that cannot both be blocked.",
    starter: "human", // Human is playing Red
    // Move sequence to set up board
    moves: [3, 3, 2, 2, 4, 4, 1, 5],
    targetPlayer: 1, // Red to move
    solution: 3, // Column 3 creates unstoppable fork
    hint: "Look for an alignment that simultaneously opens up diagonal and horizontal threats."
  },
  {
    id: "puzzle-2",
    title: "Sudden Defense (Mate in 1 Defense)",
    difficulty: "Essential",
    description: "Opponent (Yellow) has set up an imminent 4-in-a-row. Identify the ONLY surviving defensive block.",
    starter: "human",
    moves: [0, 1, 0, 1, 0, 1], // Yellow has 3 in col 1
    targetPlayer: 1,
    solution: 1, // Must drop in column 1 to prevent vertical win
    hint: "Check column 1 vertical height."
  },
  {
    id: "puzzle-3",
    title: "The Diagonal Infiltration",
    difficulty: "Advanced",
    description: "Spot the hidden diagonal trap before the opponent establishes row parity control.",
    starter: "human",
    moves: [3, 2, 2, 1, 1, 0, 1, 0, 0, 4, 0],
    targetPlayer: 1,
    solution: 3,
    hint: "Build upon the bottom diagonal slope extending from Column 0 to Column 3."
  },
  {
    id: "puzzle-4",
    title: "The Center Squeeze",
    difficulty: "Master",
    description: "Capitalize on central column dominance to restrict opponent mobility into a forced loss.",
    starter: "human",
    moves: [3, 2, 3, 4, 3, 2, 2, 4],
    targetPlayer: 1,
    solution: 3,
    hint: "Column 3 controls 16 possible winning trajectories. Stack it to seal the vertical threat."
  },
  {
    id: "puzzle-5",
    title: "Odd-Row Parity Trap",
    difficulty: "Grandmaster",
    description: "First player wins in Connect Four often rely on claiming threats on odd rows. Seize row 3 control.",
    starter: "human",
    moves: [3, 3, 2, 2, 4, 4, 1, 1, 5, 5],
    targetPlayer: 1,
    solution: 3,
    hint: "Claiming the odd row above the center stack creates an uncounterable future zugzwang."
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PUZZLES };
} else if (typeof window !== 'undefined') {
  window.PUZZLES = PUZZLES;
}
