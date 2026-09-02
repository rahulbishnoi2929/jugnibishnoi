// The chapter, opened in place. It scrolls inside itself and nothing
// follows it — that is the point: a branch is a destination, not a
// section you fall out of the bottom of into the next one.
export default function Panel({ chapter, onBack }) {
  if (!chapter) return null

  const { title, years, place, lede, body, artifacts = [], accent, scene } = chapter

  return (
    <aside
      className="panel"
      style={{ '--node': accent }}
      aria-label={title}
      key={chapter.id}
    >
      {scene && (
        <div className="panel-scene" style={{ backgroundImage: `url(${scene})` }} />
      )}

      <div className="panel-scroll">
        <button className="panel-back" onClick={onBack}>
          ← All chapters
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

        {artifacts.map((a, i) => (
          <Artifact key={i} {...a} />
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
