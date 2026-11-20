// A game clock, for chess and Connect Four alike. Pure — no React, no timers, no Date.now inside it.
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

// Every turn is timed. Thirty seconds for your first move, a minute for
// each one after, and taking all of it loses. Your bank goes back to a
// full minute every time you move rather than carrying over, so a quick
// move buys nothing but the move.
export const TURN = { first: 30_000, next: 60_000 }

// `refill` is what a side's time goes back to each time it moves; without
// one the clock is an ordinary game clock that only ever runs down.
export const newClock = (ms = TURN.first, refill = TURN.next) => ({
  w: ms,
  b: ms,
  turn: null,
  since: null,
  refill,
})

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
// over. This is the only place a side's time actually goes down — and,
// on a move clock, where it goes back up to the full minute.
export function press(clock, now) {
  if (!clock || !clock.turn) return clock
  const side = clock.turn
  const other = side === 'w' ? 'b' : 'w'
  return {
    ...clock,
    [side]: clock.refill ?? left(clock, side, now),
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
