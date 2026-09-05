import { useEffect, useRef, useState } from 'react'

// One photo, full screen, with what is known about it around the edges.
//
// The four questions are his idea and they are the reason this exists: a
// wall of photographs tells you nothing, and when / where / what / why
// turns each one into a record. They also solve the harder problem, which
// is that "describe this photo" is paralysing and four short questions are
// not.
//
// On a wide screen they sit in the four corners around the frame. A phone
// is 375 pixels across and cannot put text either side of a photo, so
// there they stack underneath in a two-by-two. Same four fields, the
// arrangement the screen allows.
//
// Anything not yet written is simply absent — no "unknown", no empty
// label. A photo with nothing said about it is still worth showing.
const FACTS = [
  ['when', 'When'],
  ['where', 'Where'],
  ['what', 'What'],
  ['why', 'Why'],
]

export default function Plate({ photo, list, onClose, onMove }) {
  const [loaded, setLoaded] = useState(false)
  const touch = useRef(null)
  const closeButton = useRef(null)

  const index = list.findIndex((p) => p.id === photo.id)
  const step = (by) => {
    const next = list[index + by]
    if (next) onMove(next)
  }

  // The full 1600px file is only fetched when a plate opens, so the grid
  // costs thumbnails and nothing more. Reset on every change or the old
  // photo stays sharp under the new one.
  useEffect(() => setLoaded(false), [photo.id])

  useEffect(() => {
    // Focus moves to the plate, so the arrow keys reach it and a screen
    // reader lands on the thing that just opened rather than staying in
    // the grid behind it.
    closeButton.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, list])

  // Swipe, because on a phone that is how you move through photographs.
  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    // Sideways only, and far enough to be a swipe rather than a tap that
    // slid a little.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1)
  }

  const written = FACTS.filter(([key]) => photo[key])

  return (
    <div
      className="plate"
      role="dialog"
      aria-modal="true"
      aria-label={photo.label}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Clicking the backdrop closes, which is what everyone tries first.
          The frame stops the click so a tap on the photo does not. */}
      <div className="plate-back" onClick={onClose} />

      <button
        className="plate-close"
        ref={closeButton}
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      {index > 0 && (
        <button
          className="plate-step is-prev"
          onClick={() => step(-1)}
          aria-label="Previous photo"
        >
          ←
        </button>
      )}
      {index < list.length - 1 && (
        <button
          className="plate-step is-next"
          onClick={() => step(1)}
          aria-label="Next photo"
        >
          →
        </button>
      )}

      <figure className="plate-frame" onClick={(e) => e.stopPropagation()}>
        {photo.video ? (
          <video src={photo.url} controls autoPlay muted loop playsInline />
        ) : (
          <img
            src={photo.url}
            alt={photo.label}
            className={loaded ? 'is-loaded' : ''}
            onLoad={() => setLoaded(true)}
            decoding="async"
          />
        )}

        {written.length > 0 && (
          <figcaption className="plate-facts">
            {written.map(([key, label]) => (
              <div className={'plate-fact is-' + key} key={key}>
                <span className="plate-fact-label">{label}</span>
                <span className="plate-fact-value">{photo[key]}</span>
              </div>
            ))}
          </figcaption>
        )}
      </figure>

      <p className="plate-count">
        {index + 1} of {list.length}
      </p>
    </div>
  )
}
