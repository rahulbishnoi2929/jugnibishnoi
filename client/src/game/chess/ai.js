// A chess opponent. Pure — no React, no DOM. Run ai.test.mjs after
// touching anything here.
//
// The rules are chess.js's job, not mine. Castling rights, en passant,
// promotion, threefold repetition and the fifty-move rule are exactly the
// things a hand-rolled board gets subtly wrong, and a chess game that is
// subtly wrong is worse than no chess game. This file only decides which
// of the legal moves to play.
//
// Search is alpha-beta over iterative deepening with a time budget, so the
// opponent is as good as it can be in the time it is given rather than as
// good as a fixed depth happens to be on that device. A phone and a laptop
// both answer in about the same wall-clock time; the phone just sees less.

import { Chess } from 'chess.js'

// Centipawns. A pawn is 100, and the king is worth more than everything
// else on the board put together so that losing it dominates any material.
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// Where each piece would rather be, from white's side. Added to the piece
// value, so a knight on the rim really is worth less than one in the
// middle. Flipped for black.
//
// These are the standard simplified tables — they are not tuned, and they
// do not need to be: the point is that the opponent develops pieces and
// pushes pawns instead of shuffling a rook, which is the difference
// between a game and a chore.
const SQUARES = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0, 20, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
}

const FILES = 'abcdefgh'
// chess.js names squares; the tables are indexed from a8 across to h1.
const indexOf = (square) => {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1])
  return (8 - rank) * 8 + file
}

// What the position is worth to white, in centipawns.
export function evaluate(game) {
  let score = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      const table = SQUARES[piece.type]
      const i = indexOf(piece.square)
      // The tables are written from white's point of view, so black reads
      // them upside down.
      const place = table[piece.color === 'w' ? i : 63 - i]
      const worth = VALUE[piece.type] + place
      score += piece.color === 'w' ? worth : -worth
    }
  }
  return score
}

// Mate is worth more than any amount of material, and a mate found sooner
// is worth more than the same mate found later — otherwise the opponent
// sees no reason to actually deliver it.
const MATE = 100000

function terminal(game, ply) {
  if (game.isCheckmate()) return { over: true, score: -(MATE - ply) }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return { over: true, score: 0 }
  }
  return { over: false }
}

// Captures first, and the biggest capture first. Alpha-beta is only as
// good as its move ordering: searching the queen takes before the pawn
// shuffles is most of what makes a depth worth reaching.
function ordered(game) {
  const moves = game.moves({ verbose: true })
  return moves.sort((a, b) => worthOf(b) - worthOf(a))
}
const worthOf = (m) =>
  (m.captured ? VALUE[m.captured] - VALUE[m.piece] / 10 : 0) +
  (m.promotion ? VALUE[m.promotion] : 0) +
  (m.san.includes('#') ? MATE : m.san.includes('+') ? 50 : 0)

// Negamax with alpha-beta. Returns the score for the side to move.
function search(game, depth, alpha, beta, ply, deadline) {
  const end = terminal(game, ply)
  if (end.over) return end.score
  if (depth <= 0) {
    const score = evaluate(game)
    return game.turn() === 'w' ? score : -score
  }
  // Out of time: answer with something rather than nothing. The caller
  // keeps the last completed depth, so a half-searched one is discarded.
  if (Date.now() > deadline) return null

  let best = -Infinity
  for (const move of ordered(game)) {
    game.move(move)
    const got = search(game, depth - 1, -beta, -alpha, ply + 1, deadline)
    game.undo()
    if (got === null) return null
    const score = -got
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break // this branch is already worse than one we have
  }
  return best
}

// How hard it tries, and how honest it is about it.
//
// Easy is not a shallow search — a shallow search still never hangs a
// queen, which is not what losing to a beginner feels like. It is a
// one-move look with a real chance of picking something other than the
// best, so it takes free material but misses plans and will drop a piece.
// `slip` is how often it plays something other than its best, and
// `window` is how much worse that something is allowed to be, in
// centipawns. A slip is meant to read as a human missing a plan — at easy
// it will drop a piece, at medium only a tempo.
export const LEVELS = {
  easy: { depth: 2, ms: 120, slip: 0.45, window: 700 },
  medium: { depth: 3, ms: 450, slip: 0.12, window: 220 },
  hard: { depth: 5, ms: 1400, slip: 0, window: 0 },
}

// Pick a move. `at` is a FEN; returns a move in chess.js verbose form, or
// null if the game is already over.
export function bestMove(at, level = 'medium', random = Math.random, ms = null) {
  const rules = LEVELS[level] ?? LEVELS.medium
  const game = new Chess(at)
  const moves = ordered(game)
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  // A clock, if there is one, can give it less time than its level.
  const deadline = Date.now() + (ms ?? rules.ms)
  let scored = moves.map((m) => ({ move: m, score: -Infinity }))

  // Iterative deepening: finish a depth, keep it, try the next one. If the
  // clock runs out mid-depth that depth is thrown away rather than half
  // believed.
  for (let depth = 1; depth <= rules.depth; depth++) {
    const round = []
    let done = true
    for (const { move } of scored) {
      game.move(move)
      const got = search(game, depth - 1, -Infinity, Infinity, 1, deadline)
      game.undo()
      if (got === null) { done = false; break }
      round.push({ move, score: -got })
    }
    if (!done) break
    // Best first, so the next depth searches the most promising move first
    // and prunes harder.
    round.sort((a, b) => b.score - a.score)
    scored = round
    if (Math.abs(scored[0].score) > MATE - 100) break // mate found; stop
  }

  // A slip is a move chosen from the ones that are nearly as good, which
  // at easy includes some genuinely bad ones. Never a slip when there is
  // a mate on the board — missing that is not a human mistake, it is a
  // broken opponent.
  const top = scored[0]
  if (rules.slip > 0 && random() < rules.slip && Math.abs(top.score) < MATE - 100) {
    const near = scored.filter((s) => top.score - s.score < rules.window)
    // And if nothing is within the window, it plays its best. There is no
    // slip to make. This used to fall back to the whole move list, which
    // is not a slip — it is a random move, and at medium that meant one
    // game in eight where it hung its queen for nothing.
    if (near.length > 1) return near[Math.floor(random() * near.length)].move
  }
  return top.move
}

// What the game is: whose turn, and whether it has ended and how.
export function state(at) {
  const game = new Chess(at)
  if (game.isCheckmate()) {
    return { over: true, winner: game.turn() === 'w' ? 'b' : 'w', why: 'checkmate' }
  }
  if (game.isStalemate()) return { over: true, winner: null, why: 'stalemate' }
  if (game.isThreefoldRepetition()) return { over: true, winner: null, why: 'repetition' }
  if (game.isInsufficientMaterial()) return { over: true, winner: null, why: 'too few pieces' }
  if (game.isDraw()) return { over: true, winner: null, why: 'the fifty-move rule' }
  return { over: false, winner: null, why: null, check: game.inCheck() }
}
