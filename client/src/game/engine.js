// Connect Four. Pure — no React, no DOM, no randomness.
// The AI searches with this and the UI renders with it, so the rules exist
// in exactly one place. Run engine.test.mjs after touching anything here.

export const COLS = 7
export const ROWS = 6
export const YOU = 1
export const CPU = 2

// Board is a flat array, index = row * COLS + col, row 0 is the top.
export const newBoard = () => new Array(ROWS * COLS).fill(0)
export const at = (b, r, c) => b[r * COLS + c]

export const canDrop = (b, c) => c >= 0 && c < COLS && at(b, 0, c) === 0

export const validMoves = (b) => {
  const out = []
  for (let c = 0; c < COLS; c++) if (canDrop(b, c)) out.push(c)
  return out
}

// Returns a new board, or null if the column is full or out of range.
export function drop(b, c, player) {
  if (!canDrop(b, c)) return null
  const next = b.slice()
  for (let r = ROWS - 1; r >= 0; r--) {
    if (next[r * COLS + c] === 0) {
      next[r * COLS + c] = player
      return next
    }
  }
  return null
}

// Which row a piece would land in — used to animate the drop.
export function landingRow(b, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (at(b, r, c) === 0) return r
  return -1
}

const DIRS = [
  [0, 1], // →
  [1, 0], // ↓
  [1, 1], // ↘
  [1, -1], // ↙
]

// Returns { player, cells } for a win, 'draw', or null if still playing.
export function result(b) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = at(b, r, c)
      if (!p) continue
      for (const [dr, dc] of DIRS) {
        const endR = r + dr * 3
        const endC = c + dc * 3
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue
        if (
          at(b, r + dr, c + dc) === p &&
          at(b, r + dr * 2, c + dc * 2) === p &&
          at(b, endR, endC) === p
        ) {
          return {
            player: p,
            cells: [
              r * COLS + c,
              (r + dr) * COLS + (c + dc),
              (r + dr * 2) * COLS + (c + dc * 2),
              endR * COLS + endC,
            ],
          }
        }
      }
    }
  }
  return b.every((v) => v !== 0) ? 'draw' : null
}
