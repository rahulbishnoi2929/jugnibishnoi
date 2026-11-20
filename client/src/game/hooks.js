import { useEffect, useState } from 'react'
import { flagged, newClock, press, start, stop } from './clock.js'

// What both games need from a clock: it is running from the moment the
// board is out, it notices when somebody runs out, and it redraws often
// enough to watch it go.
//
// You always move first, as 'w'. The time is worked out from the clock
// and the moment you look, never counted down in storage, so a
// backgrounded tab that stops firing timers does not gain anybody a turn.
export function useTurnClock(live) {
  const [clock, setClock] = useState(() => start(newClock(), 'w', Date.now()))
  // Who ran out, if anybody — 'w' or 'b'.
  const [flag, setFlag] = useState(null)
  const [, setTick] = useState(0)

  // The flag check lives in the loop rather than in an effect on the
  // clock: the clock only changes when somebody moves, and running out
  // is exactly what happens when nobody does.
  useEffect(() => {
    if (!live || clock.turn == null) return
    const id = setInterval(() => {
      const out = flagged(clock, Date.now())
      if (out) {
        setFlag(out)
        setClock((c) => stop(c, Date.now()))
      }
      setTick((n) => n + 1)
    }, 100)
    return () => clearInterval(id)
  }, [live, clock])

  return {
    clock,
    flag,
    // A move was made. `ended` stops the clock too, so a game won on the
    // board does not go on showing somebody's time running out.
    moved: (ended = false) =>
      setClock((c) => {
        const now = Date.now()
        const next = press(c, now)
        return ended ? stop(next, now) : next
      }),
    reset: () => {
      setFlag(null)
      setClock(start(newClock(), 'w', Date.now()))
    },
  }
}

// A button that has to be pressed twice when pressing it once would
// throw a game away. The first press arms it and changes its label; it
// disarms itself after a few seconds, so a stray tap is forgotten.
//
//   const [armed, guard] = useSure()
//   <button onClick={guard('new', inProgress, again)}>
//     {armed === 'new' ? 'Sure? Tap again' : 'New game'}
export function useSure() {
  const [armed, setArmed] = useState(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const guard = (key, risky, act) => () => {
    if (risky && armed !== key) return setArmed(key)
    setArmed(null)
    act()
  }
  return [armed, guard]
}
