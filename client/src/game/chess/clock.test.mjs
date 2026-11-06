// Run: node client/src/game/chess/clock.test.mjs
//
// The clock takes the time rather than reading it, so a game that flags
// on move forty plays out here in no time at all.

import assert from 'node:assert/strict'
import { CONTROLS, controlOf, newClock, left, start, press, stop, flagged, show, budget } from './clock.js'

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

test('a fresh clock has not started', () => {
  const c = newClock(60_000)
  assert.equal(left(c, 'w', 1000), 60_000, 'white lost time before the game began')
  assert.equal(left(c, 'b', 9999), 60_000, 'black lost time before the game began')
  assert.equal(flagged(c, 9999), null)
})

test('only the side to move loses time', () => {
  let c = start(newClock(60_000), 'w', 0)
  assert.equal(left(c, 'w', 10_000), 50_000, 'white should have spent ten seconds')
  assert.equal(left(c, 'b', 10_000), 60_000, 'black is not on the clock yet')
})

test('pressing it banks what you used and hands it over', () => {
  let c = start(newClock(60_000), 'w', 0)
  c = press(c, 10_000)
  assert.equal(c.w, 50_000, 'white should have banked fifty seconds')
  assert.equal(c.turn, 'b')
  assert.equal(left(c, 'b', 14_000), 56_000, 'black should have spent four')
  assert.equal(left(c, 'w', 14_000), 50_000, 'white should not move while black thinks')
})

test('a whole game of presses adds up', () => {
  // Ten moves each, three seconds a move.
  let c = start(newClock(60_000), 'w', 0)
  let now = 0
  for (let i = 0; i < 20; i++) {
    now += 3000
    c = press(c, now)
  }
  assert.equal(c.w, 60_000 - 30_000, 'white should have spent thirty seconds')
  assert.equal(left(c, 'b', now), 60_000 - 30_000, 'and black the same')
})

test('it flags, and not before', () => {
  let c = start(newClock(60_000), 'w', 0)
  assert.equal(flagged(c, 59_999), null, 'flagged with a millisecond left')
  assert.equal(flagged(c, 60_000), 'w', 'did not flag on empty')
  assert.equal(flagged(c, 90_000), 'w', 'should stay flagged')
  // And the other side is untouched by it.
  assert.equal(left(c, 'b', 90_000), 60_000)
})

test('stopping it keeps what was left', () => {
  let c = start(newClock(60_000), 'w', 0)
  c = stop(c, 20_000)
  assert.equal(c.w, 40_000)
  assert.equal(c.turn, null)
  assert.equal(left(c, 'w', 999_999), 40_000, 'a stopped clock kept counting')
})

test('no clock means no clock', () => {
  const c = newClock(null)
  assert.equal(left(c, 'w', 10_000), null)
  assert.equal(flagged(c, 10_000), null, 'a game with no clock cannot be lost on time')
})

test('it reads the way a clock reads', () => {
  assert.equal(show(1_800_000), '30:00')
  assert.equal(show(60_000), '1:00')
  assert.equal(show(61_000), '1:01')
  assert.equal(show(20_000), '0:20')
  assert.equal(show(19_999), '20.0', 'just under twenty is where tenths begin')
  assert.equal(show(19_900), '19.9')
  assert.equal(show(1_500), '1.5')
  assert.equal(show(0), '0.0')
  assert.equal(show(-500), '0.0', 'a clock does not go negative on screen')
  assert.equal(show(null), '')
  // Seconds round up, so "1:00" is not shown for a clock that has 400ms.
  assert.equal(show(59_400), '1:00')
})

test('the opponent spends its time at a rate that lasts', () => {
  // A fortieth of what is left, because that is about how many moves a
  // game of chess has in it, capped by what the level would have spent.
  assert.equal(budget(1400, 1_800_000), 1400, 'half an hour is plenty; use the level')
  assert.equal(budget(1400, 20_000), 500, 'twenty seconds left means half a second a move')
  assert.equal(budget(450, 20_000), 450, 'never more than the level would have taken')

  // It must always answer, however little is left.
  assert.ok(budget(1400, 1000) >= 60, 'it must still play a move with a second left')
  assert.ok(budget(1400, 0) >= 60, 'and even on an empty clock it returns something')

  // And it must spend less as it runs down, or it flags while playing well.
  assert.ok(budget(1400, 10_000) < budget(1400, 60_000), 'it should think less as it runs low')

  assert.equal(budget(450, null), 450, 'no clock, no constraint')
})

test('the time controls are the ones offered', () => {
  assert.deepEqual(CONTROLS.map((c) => c.id), ['off', '1', '2', '10', '30'])
  assert.equal(controlOf('10').ms, 600_000)
  assert.equal(controlOf('nonsense').id, 'off', 'an unknown control should fall back to no clock')
  for (const c of CONTROLS) {
    if (c.ms !== null) assert.ok(c.ms > 0, c.id + ' is not a length of time')
    assert.ok(c.label && c.label.length <= 3, c.id + ' has a label too long for a row of five')
    assert.ok(c.name && c.name.length > 2, c.id + ' has no name for a screen reader')
  }
})

console.log('\n' + passed + ' passed')
