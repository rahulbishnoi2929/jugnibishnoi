// A chess clock. Pure — no React, no timers, no Date.now inside it.
//
// Every function here is given the current time rather than reading it,
// which is what makes a clock testable: a game that flags on move forty
// can be played out in a millisecond.
//
// The shape is the standard one. Each side has a number of milliseconds
// banked. The side to move also has a `since` — when their turn started —
// and what they have left is the bank minus however long it has been.
// Nothing counts down in storage; it is worked out when you look. That is
// what stops a clock drifting when a tab is backgrounded and the timer it
// was leaning on stops firing.

// What you can pick.
//
// Two labels each: a short one for the button, because five of
// "30 min" across a row wraps onto a second line and costs more height
// than the board can spare, and a full one for anybody listening rather
// than looking.
export const CONTROLS = [
  { id: 'off', label: '∞', name: 'No clock', ms: null },
  { id: '1', label: "1'", name: 'One minute', ms: 60_000 },
  { id: '2', label: "2'", name: 'Two minutes', ms: 120_000 },
  { id: '10', label: "10'", name: 'Ten minutes', ms: 600_000 },
  { id: '30', label: "30'", name: 'Thirty minutes', ms: 1_800_000 },
]

export const controlOf = (id) => CONTROLS.find((c) => c.id === id) ?? CONTROLS[0]

export const newClock = (ms) => ({ w: ms, b: ms, turn: null, since: null })

// What a side has left, now.
export function left(clock, side, now) {
  if (!clock || clock[side] == null) return null
  const banked = clock[side]
  // `since == null` rather than `!since`: zero is a real moment, and a
  // clock started at it would never have counted.
  if (clock.turn !== side || clock.since == null) return banked
  return Math.max(0, banked - (now - clock.since))
}

// Start the clock running for whoever is to move. Idempotent: starting a
// clock that is already running for that side changes nothing, so it can
// be called from a render without consequence.
export function start(clock, side, now) {
  if (!clock || clock.turn === side) return clock
  return { ...clock, turn: side, since: now }
}

// A move has been played. Bank what the mover used and hand the clock
// over. This is the only place a side's time actually goes down.
export function press(clock, now) {
  if (!clock || !clock.turn) return clock
  const side = clock.turn
  const other = side === 'w' ? 'b' : 'w'
  return {
    ...clock,
    [side]: left(clock, side, now),
    turn: other,
    since: now,
  }
}

export const stop = (clock, now) =>
  !clock || !clock.turn ? clock : { ...clock, [clock.turn]: left(clock, clock.turn, now), turn: null, since: null }

// Who, if anyone, has run out.
export function flagged(clock, now) {
  if (!clock) return null
  if (left(clock, 'w', now) === 0) return 'w'
  if (left(clock, 'b', now) === 0) return 'b'
  return null
}

// mm:ss, and under twenty seconds the tenths, which is when a tenth
// starts to matter and not before — a display that always shows them
// reads as a stopwatch rather than a clock.
export function show(ms) {
  if (ms == null) return ''
  const safe = Math.max(0, ms)
  if (safe < 20_000) return (Math.ceil(safe / 100) / 10).toFixed(1)
  const total = Math.ceil(safe / 1000)
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0')
}

// How long the opponent may think, given what it has left.
//
// Hard spends 1.4 seconds a move, which is nothing in a thirty minute
// game and most of a one minute one: forty moves at that rate is longer
// than the whole clock, so it would sit there and lose on time while
// playing well. It gets a share of what is left instead, and never more
// than its level would have taken anyway.
export function budget(levelMs, leftMs) {
  if (leftMs == null) return levelMs
  // A fortieth of what is left, which is about what a game of chess
  // needs, capped by the level and floored so that it always gets to
  // look at least one move deep rather than moving at random.
  return Math.max(60, Math.min(levelMs, Math.floor(leftMs / 40)))
}
