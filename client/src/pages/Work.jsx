import { Link } from 'react-router-dom'
import { me, links, stats, featured, also } from '../content/work.js'

// The escape hatch (docs/DESIGN.md §8). Deliberately plain. No canvas,
// no scroll effects, no webfonts. Its job is to be boring in 40 seconds.

export default function Work() {
  const live = links.filter((l) => l.href)

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      <div className="wrap">
        <header>
          <h1 className="name">{me.name}</h1>
          <p className="tagline">{me.tagline}</p>

          <ul className="links">
            {live.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noreferrer noopener">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </header>

        <div className="stats">
          {stats.map((s) => (
            <p key={s.label}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </p>
          ))}
        </div>

        <main id="main">
          <section className="section">
            <h2 className="section-head">Building</h2>
            <div className="cards">
              {featured.map((p) => (
                <Project key={p.title} {...p} />
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section-head">Also</h2>
            <div className="cards">
              {also.map((p) => (
                <a
                  className="card"
                  key={p.title}
                  href={p.repo}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <h3 className="card-title">{p.title}</h3>
                  <p className="card-blurb">{p.blurb}</p>
                </a>
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <a href={`mailto:${me.email}`}>{me.email}</a>
          <a href={me.resume}>Resume (PDF)</a>
          <Link to="/">The long version ←</Link>
          <span className="note">Fazilka, Punjab</span>
        </footer>
      </div>
    </>
  )
}

function Project({ title, blurb, body, problem, stack, repo, live }) {
  return (
    <article className="card">
      <h3 className="card-title">{title}</h3>
      <p className="card-blurb">{blurb}</p>
      <p className="card-body">{body}</p>
      {problem && <p className="card-problem">{problem}</p>}

      <ul className="tags">
        {stack.map((s) => (
          <li className="tag" key={s}>
            {s}
          </li>
        ))}
      </ul>

      <p className="card-meta">
        {live && (
          <a href={live} target="_blank" rel="noreferrer noopener">
            Live ↗{' '}
          </a>
        )}
        {repo ? (
          <a href={repo} target="_blank" rel="noreferrer noopener">
            Source ↗
          </a>
        ) : (
          'Private repo — happy to walk through it'
        )}
      </p>
    </article>
  )
}
