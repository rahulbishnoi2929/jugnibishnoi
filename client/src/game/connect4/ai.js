import { COLS, ROWS, YOU, CPU, at, drop, validMoves, result } from './engine.js'

// Minimax with alpha-beta. Depth 5 is a genuinely annoying opponent and
// still returns in a few milliseconds, so no worker and no async.
const DEPTH = 5

// Every line of four on the board, precomputed once.
const LINES = (() => {
  const out = []
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of dirs) {
        const er = r + dr * 3
        const ec = c + dc * 3
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue
        out.push([
          [r, c],
          [r + dr, c + dc],
          [r + dr * 2, c + dc * 2],
          [er, ec],
        ])
      }
  return out
})()

// Centre columns are worth more: they take part in more lines.
const COL_BONUS = [1, 2, 4, 7, 4, 2, 1]

function score(b) {
  let s = 0
  for (const line of LINES) {
    let mine = 0
    let yours = 0
    for (const [r, c] of line) {
      const v = at(b, r, c)
      if (v === CPU) mine++
      else if (v === YOU) yours++
    }
    if (mine && yours) continue // blocked, worth nothing to either side
    if (mine === 3) s += 60
    else if (mine === 2) s += 8
    else if (mine === 1) s += 1
    if (yours === 3) s -= 75 // block a little harder than you build
    else if (yours === 2) s -= 9
    else if (yours === 1) s -= 1
  }
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const v = at(b, r, c)
      if (v === CPU) s += COL_BONUS[c]
      else if (v === YOU) s -= COL_BONUS[c]
    }
  return s
}

function search(b, depth, alpha, beta, maximising) {
  const res = result(b)
  if (res === 'draw') return 0
  if (res) return res.player === CPU ? 100000 + depth : -100000 - depth
  if (depth === 0) return score(b)

  const moves = validMoves(b).sort(
    (x, y) => COL_BONUS[y] - COL_BONUS[x] // search the middle first, prune more
  )

  if (maximising) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, search(drop(b, m, CPU), depth - 1, alpha, beta, false))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }

  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, search(drop(b, m, YOU), depth - 1, alpha, beta, true))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

// Best column for the computer, or -1 if the board is full.
export function bestMove(b, depth = DEPTH) {
  const moves = validMoves(b)
  if (!moves.length) return -1

  let best = -Infinity
  let pick = moves[0]
  for (const m of moves.sort((x, y) => COL_BONUS[y] - COL_BONUS[x])) {
    const v = search(drop(b, m, CPU), depth - 1, -Infinity, Infinity, false)
    if (v > best) {
      best = v
      pick = m
    }
  }
  return pick
}
