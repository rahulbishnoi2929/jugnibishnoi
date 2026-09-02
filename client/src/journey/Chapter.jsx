export default function Chapter({ chapter, index }) {
  const { id, title, years, place, lede, body, scene, artifacts = [] } = chapter

  // Scenes are static .svg files, not inline SVG. As live DOM the field
  // re-rasterised behind a sticky element on every scroll frame and stalled
  // the compositor; as a background image the browser draws it once.
  return (
    <section
      className={'chapter' + (scene ? ' has-scene' : '')}
      id={id}
      style={{ '--chapter': chapter.accent }}
    >
      {scene && (
        <div className="scene" style={{ backgroundImage: `url(${scene})` }} />
      )}

      <div className="chapter-inner">
        <p className="chapter-num">
          {String(index + 1).padStart(2, '0')} <span>{years}</span>
        </p>

        <h2 className="chapter-title">{title}</h2>
        {place && <p className="chapter-place">{place}</p>}
        {lede && <p className="chapter-lede">{lede}</p>}

        <div className="chapter-body">
          {body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {artifacts.length > 0 && (
          <div className="artifacts">
            {artifacts.map((a, i) => (
              <Artifact key={i} {...a} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Artifact({ type, src, alt, caption, value, label, text, source }) {
  if (type === 'stat') {
    return (
      <p className="art-stat">
        <span className="art-stat-value">{value}</span>
        <span className="art-stat-label">{label}</span>
      </p>
    )
  }

  if (type === 'quote') {
    return (
      <blockquote className="art-quote">
        <p>{text}</p>
        {source && <cite>{source}</cite>}
      </blockquote>
    )
  }

  // Photos are dropped into client/public/photos/ as they arrive. Until a
  // file exists the figure removes itself, so missing art costs nothing.
  return (
    <figure className="art-photo">
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
