import { useCallback, useEffect, useRef } from 'react'

// A wheel you drag round to move the list.
//
// Forty-eight songs is ten screens. A scrollbar that thin is a poor
// target and a flick on the list itself only ever buys you one screen,
// so the long lists wanted something you can keep your thumb on.
//
// One turn moves eight rows. That is the whole of the tuning: enough
// that a slow circle reads as deliberate, few enough that the list does
// not bolt. A fast turn carries on afterwards and decays, the same way
// the globe does when you fling it.

// Rows per full turn of the wheel.
const ROWS_PER_TURN = 8

// What a flick keeps, per second. Same shape as the globe's coast: an
// exponential decay integrated against real time, so it travels the same
// distance at 30 frames a second as at 144.
const KEEP = 0.0022
const STOP = 30

export default function Wheel({ scroller, rows, label }) {
  const ring = useRef(null)
  const drag = useRef(null)
  const glide = useRef(0)
  const raf = useRef(0)

  // Pixels of list per radian of wheel.
  const perRadian = useCallback(() => {
    const el = scroller()
    if (!el || !rows) return 0
    const row = el.scrollHeight / rows
    return (row * ROWS_PER_TURN) / (Math.PI * 2)
  }, [scroller, rows])

  const coast = useCallback(() => {
    cancelAnimationFrame(raf.current)
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const el = scroller()
      if (!el || Math.abs(glide.current) < STOP) {
        glide.current = 0
        return
      }
      // Closed form over the step rather than one multiply per frame,
      // which is what keeps it frame-rate independent.
      const left = glide.current * Math.pow(KEEP, dt)
      el.scrollTop += (left - glide.current) / Math.log(KEEP)
      glide.current = left
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [scroller])

  useEffect(() => {
    const el = ring.current
    if (!el) return

    const angle = (e) => {
      const r = el.getBoundingClientRect()
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    }

    const down = (e) => {
      el.setPointerCapture(e.pointerId)
      drag.current = { at: angle(e), when: performance.now(), speed: 0 }
      glide.current = 0
      cancelAnimationFrame(raf.current)
      el.classList.add('is-held')
    }

    const move = (e) => {
      if (!drag.current) return
      const now = angle(e)
      // The short way round, or crossing the top of the wheel jumps the
      // list by six turns.
      let turned = now - drag.current.at
      if (turned > Math.PI) turned -= Math.PI * 2
      if (turned < -Math.PI) turned += Math.PI * 2

      const px = turned * perRadian()
      const box = scroller()
      if (box) box.scrollTop += px

      const stamp = performance.now()
      const dt = Math.max(stamp - drag.current.when, 1) / 1000
      drag.current = { at: now, when: stamp, speed: px / dt }
    }

    const up = (e) => {
      if (!drag.current) return
      glide.current = drag.current.speed
      drag.current = null
      el.classList.remove('is-held')
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        // the pointer was already gone; nothing to release
      }
      coast()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(raf.current)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [coast, perRadian, scroller])

  // Whatever is nearest the middle of the list is what the button plays.
  const middle = () => {
    const box = scroller()
    if (!box) return
    const aim = box.getBoundingClientRect().top + box.clientHeight / 2
    let best = null
    for (const row of box.querySelectorAll('.track')) {
      const r = row.getBoundingClientRect()
      const d = Math.abs(r.top + r.height / 2 - aim)
      if (!best || d < best.d) best = { d, row }
    }
    best?.row.click()
  }

  if (!rows || rows < 10) return null

  return (
    <div className="wheel">
      {/* The ring takes the drag. It is not a control a keyboard can use
          and does not pretend to be one — the list itself is still a
          column of buttons you can tab through, which is the accessible
          way to the same place. */}
      <div
        className="wheel-ring"
        ref={ring}
        aria-hidden="true"
        title={'Drag to scroll ' + (label || 'the list')}
      />
      <button className="wheel-middle" onClick={middle} type="button">
        Play
        <span>what is here</span>
      </button>
    </div>
  )
}
