// Run: node client/src/game/engine.test.mjs
// No framework on purpose — plain asserts, so it needs nothing installed.
import assert from 'node:assert/strict'
import { COLS, ROWS, YOU, CPU, newBoard, drop, at, validMoves, result, landingRow } from './engine.js'
import { bestMove } from './ai.js'

let n = 0
const test = (name, fn) => {
  fn()
  n++
  console.log('  ok  ' + name)
}

// Build a board from rows of text, bottom row last. '.' empty, 'y' you, 'c' cpu.
const parse = (rows) => {
  const b = newBoard()
  rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      b[r * COLS + c] = ch === 'y' ? YOU : ch === 'c' ? CPU : 0
    })
  )
  return b
}

test('a new board is empty and every column is playable', () => {
  const b = newBoard()
  assert.equal(b.length, ROWS * COLS)
  assert.deepEqual(validMoves(b), [0, 1, 2, 3, 4, 5, 6])
  assert.equal(result(b), null)
})

test('a piece falls to the bottom, and stacks on the next drop', () => {
  let b = drop(newBoard(), 3, YOU)
  assert.equal(at(b, ROWS - 1, 3), YOU)
  b = drop(b, 3, CPU)
  assert.equal(at(b, ROWS - 2, 3), CPU)
})

test('a full column refuses more pieces', () => {
  let b = newBoard()
  for (let i = 0; i < ROWS; i++) b = drop(b, 0, i % 2 ? YOU : CPU)
  assert.equal(drop(b, 0, YOU), null)
  assert.ok(!validMoves(b).includes(0))
})

test('out-of-range columns are refused, not crashed on', () => {
  const b = newBoard()
  assert.equal(drop(b, -1, YOU), null)
  assert.equal(drop(b, COLS, YOU), null)
})

test('four across wins', () => {
  const r = result(parse(['.......', '.......', '.......', '.......', '.......', '.yyyy..']))
  assert.equal(r.player, YOU)
  assert.equal(r.cells.length, 4)
})

test('four down wins', () => {
  const r = result(parse(['.......', '.......', '..c....', '..c....', '..c....', '..c....']))
  assert.equal(r.player, CPU)
})

test('both diagonals win', () => {
  const down = result(parse(['.......', '.......', 'y......', '.y.....', '..y....', '...y...']))
  assert.equal(down.player, YOU)
  const up = result(parse(['.......', '.......', '...c...', '..c....', '.c.....', 'c......']))
  assert.equal(up.player, CPU)
})

test('three in a row is not a win', () => {
  assert.equal(result(parse(['.......', '.......', '.......', '.......', '.......', '.yyy...'])), null)
})

test('a line broken by the opponent is not a win', () => {
  assert.equal(result(parse(['.......', '.......', '.......', '.......', '.......', 'yycyy..'])), null)
})

test('a full board with no line is a draw', () => {
  // Found by brute force and pinned — hand-written "draws" kept
  // containing a diagonal, which is exactly what this test is for.
  const rows = [
    'cyccyyc',
    'ycyyycc',
    'yyycyyy',
    'cccyccc',
    'ycccyyc',
    'yyccycy',
  ]
  const b = parse(rows)
  assert.ok(b.every((v) => v !== 0), 'board should be full')
  assert.equal(result(b), 'draw')
})

test('landingRow reports where a piece would come to rest', () => {
  const b = drop(newBoard(), 2, YOU)
  assert.equal(landingRow(b, 2), ROWS - 2)
  assert.equal(landingRow(b, 5), ROWS - 1)
})

test('the AI only ever returns a legal column', () => {
  let b = newBoard()
  for (let i = 0; i < 12; i++) {
    const m = bestMove(b, 3)
    assert.ok(validMoves(b).includes(m), 'illegal move ' + m)
    b = drop(b, m, i % 2 ? YOU : CPU)
  }
})

test('the AI takes a win when one is available', () => {
  //  cpu has three across on the bottom; column 4 wins immediately
  const b = parse(['.......', '.......', '.......', '.......', 'yyy....', 'ccc....'])
  assert.equal(bestMove(b, 4), 3)
})

test('the AI blocks your win when it has none of its own', () => {
  // you threaten across the bottom at column 3
  const b = parse(['.......', '.......', '.......', '.......', '.......', 'yyy....'])
  assert.equal(bestMove(b, 4), 3)
})

test('the AI returns -1 on a full board rather than throwing', () => {
  const b = parse(['cyccyyc', 'ycyyycc', 'yyycyyy', 'cccyccc', 'ycccyyc', 'yyccycy'])
  assert.equal(bestMove(b, 2), -1)
})

console.log('\n' + n + ' passed')
