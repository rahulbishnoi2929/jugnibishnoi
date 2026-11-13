// Run: node client/src/game/chess/ai.test.mjs
//
// The opponent is pure, so it can be played against here rather than
// clicked at in a browser. Positions are FENs, which is how a chess
// position is written down — paste one into any board to see it.

import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { bestMove, evaluate, state, LEVELS } from './ai.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    console.log('  ok  ' + name)
    passed++
  } catch (e) {
    console.log('  FAIL  ' + name)
    console.log('        ' + e.message)
    process.exitCode = 1
  }
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

test('it only ever plays a legal move', () => {
  // Every level, and from a real game rather than the opening alone: an
  // illegal move from an opponent is not a bug you can recover from.
  for (const level of Object.keys(LEVELS)) {
    const game = new Chess()
    for (let i = 0; i < 12 && !game.isGameOver(); i++) {
      const move = bestMove(game.fen(), level, Math.random, 150)
      assert.ok(move, level + ': no move offered on move ' + i)
      const legal = game.moves({ verbose: true })
      assert.ok(
        legal.some((m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion),
        level + ': ' + move.san + ' is not legal in ' + game.fen()
      )
      game.move(move)
    }
  }
})

test('hard finds mate in one', () => {
  // Back-rank mate: the rook drops to a8 and the king has no escape.
  const game = new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1')
  const move = bestMove(game.fen(), 'hard')
  game.move(move)
  assert.ok(game.isCheckmate(), 'played ' + move.san + ' instead of mate')
})

test('medium finds mate in one too', () => {
  const game = new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1')
  const move = bestMove(game.fen(), 'medium')
  game.move(move)
  assert.ok(game.isCheckmate(), 'played ' + move.san + ' instead of mate')
})

test('even easy takes mate when it is there', () => {
  // A slip is meant to feel like a human missing a plan, not like an
  // opponent that cannot see the end of the game. The slip is suppressed
  // when a mate is on the board, so this holds every time rather than
  // most times.
  for (let i = 0; i < 25; i++) {
    const game = new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1')
    const move = bestMove(game.fen(), 'easy')
    game.move(move)
    assert.ok(game.isCheckmate(), 'easy played ' + move.san + ' on try ' + i)
  }
})

test('it takes a free queen', () => {
  // Black queen on d5 with a white pawn on e4 looking at it, and
  // nothing defending it. The first version of this test used a board
  // where the d-file was blocked by White's own pawn, so nothing could
  // reach d5 at all — the engine was right and the test was wrong.
  const game = new Chess('rnb1kbnr/ppp1pppp/8/3q4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1')
  for (const level of ['medium', 'hard']) {
    const move = bestMove(game.fen(), level, Math.random, 150)
    assert.equal(move.to, 'd5', level + ' played ' + move.san + ' and left the queen')
  }
})

test('it does not hang its own queen for nothing', () => {
  // From the opening, at the levels that are meant to be competent.
  for (const level of ['medium', 'hard']) {
    const game = new Chess(START)
    for (let i = 0; i < 8; i++) {
      const move = bestMove(game.fen(), level, Math.random, 150)
      game.move(move)
      // Reply with the best capture available, if any.
      const replies = game.moves({ verbose: true }).filter((m) => m.captured === 'q')
      assert.equal(
        replies.length,
        0,
        level + ' left its queen takeable after ' + game.history().join(' ')
      )
      const any = game.moves({ verbose: true })
      if (!any.length) break
      game.move(any[Math.floor(any.length / 2)])
    }
  }
})

// A seeded random, so easy's slips are the same slips every run. The
// first version of this test used Math.random and the machine's own
// speed, and failed one deploy in a few on GitHub's slower runners.
const seeded = (n) => () => {
  n |= 0; n = (n + 0x6d2b79f5) | 0
  let t = Math.imul(n ^ (n >>> 15), 1 | n)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const keyOf = (fen) => fen.split(' ').slice(0, 4).join(' ')

test('hard beats easy, two games in three', () => {
  // If the levels are not actually different, "easy, medium, hard" is
  // three buttons that do the same. Best of three rather than one game,
  // because a single game is one sample of something that depends on how
  // fast the machine is, and the machine is not the thing under test.
  let won = 0
  const results = []
  for (const seed of [1, 2, 3]) {
    const game = new Chess()
    const past = []
    const easy = seeded(seed)
    let moves = 0
    while (!game.isGameOver() && moves < 80) {
      const white = game.turn() === 'w'
      const move = white
        ? bestMove(game.fen(), 'hard', Math.random, 200, past)
        : bestMove(game.fen(), 'easy', easy, null, past)
      if (!move) break
      past.push(game.fen())
      game.move(move)
      moves++
    }
    const score = evaluate(game)
    const outcome = game.isCheckmate()
      ? game.turn() === 'b' ? 'hard mated easy' : 'easy mated hard'
      : game.isGameOver() ? 'drawn' : 'unfinished at ' + score
    results.push(outcome)
    if (game.isCheckmate() ? game.turn() === 'b' : !game.isGameOver() && score > 300) won++
  }
  assert.ok(won >= 2, 'hard won ' + won + ' of 3: ' + results.join(', '))
})

test('winning, it steers away from a repetition', () => {
  // A queen up. Whatever it would normally play, once the position that
  // move leads to has already happened, playing it again is a draw — and
  // a draw is worse than a won game, so it should find something else.
  // Before it was given the game's history it could not see this, and it
  // shuffled won positions into threefold repetition.
  const fen = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
  const first = bestMove(fen, 'hard', Math.random, 400)
  const game = new Chess(fen)
  game.move(first)
  const repeated = game.fen()

  const second = bestMove(fen, 'hard', Math.random, 400, [repeated])
  const check = new Chess(fen)
  check.move(second)
  assert.notEqual(
    keyOf(check.fen()),
    keyOf(repeated),
    'played ' + second.san + ' into a position that has already happened, a queen up'
  )
})

test('losing, it takes the repetition', () => {
  // The other half. A bare king against a queen and king is lost, so a
  // move into a position that has already happened — a draw — is the
  // best thing on the board, and it should play it.
  //
  // The repetition is put behind a move it would not otherwise play. The
  // first version of this test aimed at the move it preferred anyway, so
  // it passed with the history switched off and proved nothing.
  const fen = '4k3/8/8/8/8/8/8/3QK3 b - - 0 1'
  const preferred = bestMove(fen, 'hard', Math.random, 400)
  const game = new Chess(fen)
  const target = game.moves({ verbose: true }).find((m) => m.to !== preferred.to)
  assert.ok(target, 'needs a second legal move to aim at')
  game.move(target)
  const drawn = game.fen()

  const move = bestMove(fen, 'hard', Math.random, 400, [drawn])
  assert.equal(
    move.to,
    target.to,
    'played ' + move.san + ' rather than ' + target.san + ', the repetition, which was the draw'
  )
})

test('the levels are ordered: harder looks further', () => {
  assert.ok(LEVELS.easy.depth < LEVELS.medium.depth, 'easy should look less far than medium')
  assert.ok(LEVELS.medium.depth < LEVELS.hard.depth, 'medium should look less far than hard')
  assert.ok(LEVELS.easy.slip > LEVELS.medium.slip, 'easy should slip more often than medium')
  assert.equal(LEVELS.hard.slip, 0, 'hard should not slip at all')
})

test('it answers in about the time it is given', () => {
  // The budget is wall-clock, so a slow device sees less rather than
  // taking longer. A phone that locks up for six seconds is not playing
  // chess, it is broken.
  for (const level of Object.keys(LEVELS)) {
    const began = Date.now()
    bestMove(START, level)
    const took = Date.now() - began
    assert.ok(
      took < LEVELS[level].ms + 900,
      level + ' took ' + took + 'ms against a budget of ' + LEVELS[level].ms
    )
  }
})

test('an even position is worth about nothing', () => {
  assert.equal(evaluate(new Chess(START)), 0, 'the start of a game is not level')
})

test('it reads the end of a game correctly', () => {
  const mated = state('6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1')
  assert.equal(mated.over, false, 'that position is not over')

  const done = new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1')
  done.move(bestMove(done.fen(), 'hard'))
  const after = state(done.fen())
  assert.equal(after.over, true)
  assert.equal(after.why, 'checkmate')
  assert.equal(after.winner, 'w')

  const stale = state('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
  assert.equal(stale.over, true, 'that is stalemate')
  assert.equal(stale.why, 'stalemate')
  assert.equal(stale.winner, null)

  const bare = state('7k/8/6K1/8/8/8/8/8 w - - 0 1')
  assert.equal(bare.why, 'too few pieces')
})

test('it returns nothing when there is nothing to play', () => {
  assert.equal(bestMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'hard'), null, 'stalemate has no moves')
})

console.log('\n' + passed + ' passed')
