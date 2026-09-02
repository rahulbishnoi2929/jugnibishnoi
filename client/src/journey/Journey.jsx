import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import data from '../content/chapters.json'
import Rail from './Rail.jsx'
import Chapter from './Chapter.jsx'
import '../styles/journey.css'

const chapters = data.chapters

export default function Journey() {
  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState(0)
  const scope = useRef(null)

  // Progress and active chapter come from the same read, so they can never
  // disagree. An IntersectionObserver was ambiguous here: several chapters
  // cross a centre band together and the last entry won arbitrarily, which
  // skipped Build entirely.
  useEffect(() => {
    const els = [...scope.current.querySelectorAll('.chapter')]
    let frame = 0

    const measure = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)

      const mid = window.innerHeight / 2
      let i = 0
      els.forEach((el, idx) => {
        if (el.getBoundingClientRect().top <= mid) i = idx
      })
      setActive(i)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  // --accent is a registered property, so assigning a flat color here gives
  // a smooth palette migration for free (styles/tokens.css).
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', chapters[active].accent)
    // Leaving the journey drops the override so /work goes back to wheat.
    return () => root.style.removeProperty('--accent')
  }, [active])

  const jump = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="journey" ref={scope}>
      <a className="skip" href="#soil">
        Skip to content
      </a>

      <Link className="hatch" to="/work">
        Just show me the work ↗
      </Link>

      <Rail chapters={chapters} active={active} progress={progress} onJump={jump} />

      <header className="opening">
        <p className="opening-eyebrow">Mehrajpur, Fazilka — Punjab</p>
        <h1 className="opening-title">Rahul Bishnoi</h1>
        <p className="opening-line">
          Twenty-three years, told in five parts. It starts in a field and it
          has not left one yet.
        </p>
        <p className="opening-hint" aria-hidden="true">
          Scroll
        </p>
      </header>

      <main>
        {chapters.map((c, i) => (
          <Chapter key={c.id} chapter={c} index={i} />
        ))}
      </main>

      <footer className="closing">
        <p>Still going.</p>
        <Link to="/work">The work, plainly →</Link>
      </footer>
    </div>
  )
}
