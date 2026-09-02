// The left rail: progress, chapter labels, click-to-jump. All three jobs,
// one component (docs/DESIGN.md §4, §6).

export default function Rail({ chapters, active, progress, onJump }) {
  return (
    <nav className="rail" aria-label="Chapters">
      <div className="rail-track" aria-hidden="true">
        <div className="rail-fill" style={{ '--p': progress }} />
      </div>

      <ol className="rail-list">
        {chapters.map((c, i) => (
          <li key={c.id}>
            <button
              className={'rail-node' + (i === active ? ' is-active' : '')}
              style={{ '--node': c.accent }}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => onJump(c.id)}
            >
              <span className="rail-dot" aria-hidden="true" />
              <span className="rail-text">
                <span className="rail-title">{c.title}</span>
                <span className="rail-years">{c.years}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
