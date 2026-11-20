import { left, show } from './clock.js'

// One side's clock. Nothing here counts: it asks what is left at the
// moment it draws, which is why a backgrounded tab cannot gain you time.
export default function Face({ clock, side, live }) {
  const ms = left(clock, side, Date.now())
  if (ms == null) return null
  return (
    <span
      className={
        'games-face' +
        (live ? ' is-live' : '') +
        (ms < 20_000 ? ' is-low' : '') +
        (live && ms < 10_000 ? ' is-urgent' : '')
      }
      aria-label={(side === 'w' ? 'Your' : "Rahul's") + ' time'}
    >
      {show(ms)}
    </span>
  )
}
