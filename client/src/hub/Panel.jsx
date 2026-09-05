import { lazy, Suspense } from 'react'
import { mediaFor } from '../lib/media.js'
import Gallery from './Gallery.jsx'

// The game only loads if you go and play it.
const Board = lazy(() => import('../game/Board.jsx'))

// The chapter, opened in place. It scrolls inside itself and nothing
// follows it — that is the point: a branch is a destination, not a
// section you fall out of the bottom of into the next one.
export default function Panel({
  chapter,
  onBack,
  backLabel = '← All chapters',
  // Set when a branch of a chapter is open, so the gallery knows which
  // sets of photos belong to it.
  gallery,
  onOpenPhoto,
}) {
  if (!chapter) return null

  const media = mediaFor(chapter.id)

  const {
    title,
    years,
    place,
    lede,
    body = [],
    artifacts = [],
    accent,
    kind,
  } = chapter

  return (
    <aside
      className="panel"
      style={{ '--node': accent }}
      aria-label={title}
      key={chapter.id}
    >
      <div className="panel-scroll">
        <button className="panel-back" onClick={onBack}>
          {backLabel}
        </button>

        <p className="panel-years">{years}</p>
        <h2 className="panel-title">{title}</h2>
        {place && <p className="panel-place">{place}</p>}
        {lede && <p className="panel-lede">{lede}</p>}

        {body.map((p, i) => (
          <p className="panel-body" key={i}>
            {p}
          </p>
        ))}

        {kind === 'game' && (
          <Suspense fallback={<p className="panel-body">Loading the board…</p>}>
            <Board />
          </Suspense>
        )}

        {artifacts.map((a, i) => (
          <Artifact key={i} {...a} />
        ))}

        {/* Whatever is sitting in src/photos/<id>/ right now. */}
        {gallery && (
          <Gallery
            chapterId={gallery.chapter}
            branchId={gallery.branch}
            onOpen={onOpenPhoto}
          />
        )}

        {media.map((m) => (
          <figure className="panel-photo" key={m.url}>
            {m.video ? (
              <video src={m.url} controls muted loop preload="metadata" />
            ) : (
              <img src={m.thumb} alt={m.label} loading="lazy" decoding="async" />
            )}
            {m.label && <figcaption>{m.label}</figcaption>}
          </figure>
        ))}
      </div>
    </aside>
  )
}

function Artifact({ type, src, alt, caption, value, label, text, source }) {
  if (type === 'stat') {
    return (
      <p className="panel-stat">
        <span className="panel-stat-value">{value}</span>
        <span className="panel-stat-label">{label}</span>
      </p>
    )
  }

  if (type === 'quote') {
    return (
      <blockquote className="panel-quote">
        <p>{text}</p>
        {source && <cite>{source}</cite>}
      </blockquote>
    )
  }

  // Photos delete themselves until the files land in public/photos.
  return (
    <figure className="panel-photo">
      <img
        src={src}
        alt={alt === 'TODO' ? '' : alt}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const fig = e.currentTarget.closest('figure')
          if (fig) fig.hidden = true
        }}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
