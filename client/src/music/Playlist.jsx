import { useCallback, useEffect, useRef } from 'react'
import { playlistFor } from '../lib/playlists.js'
import { useMusic } from './context.js'
import Wheel from './Wheel.jsx'

// One playlist, open. The equivalent of the photo grid under a Campus
// branch — same job, different evidence.
//
// Rows are thumbnails because that is how you recognise a song you half
// remember. They come straight off YouTube's image CDN, so a list of
// fifty costs fifty <img> tags and no API call.
export default function Playlist({ id }) {
  const list = playlistFor(id)
  const { now, cue, toggle, queue, playNext, unqueue } = useMusic()
  const here = useRef(null)
  const listEl = useRef(null)
  // The box that actually scrolls is the panel the list sits in, not the
  // list — so it is found from the list rather than named.
  const scroller = useCallback(() => listEl.current?.closest('.panel-scroll') ?? null, [])

  // Bring the playing row back into view when the song changes by itself.
  //
  // Thirty-five rows is several screens, so once a track ends and the
  // next one starts the highlighted row is usually somewhere you are not
  // looking. Only when it is actually off screen, because scrolling a
  // list someone is reading is worse than the problem.
  useEffect(() => {
    const row = here.current
    if (!row) return
    const box = row.getBoundingClientRect()
    const hidden = box.top < 0 || box.bottom > window.innerHeight
    if (hidden) row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [now.id, now.index])

  if (!list) return null

  if (!list.songs.length) {
    return (
      <p className="playlist-empty">
        Nothing in here yet. Songs go in <code>playlists.json</code> — paste a
        YouTube link and a name.
      </p>
    )
  }

  return (
    <>
      {/* What is jumping the order, if anything. Shown here rather than
          hidden behind a button in the dock: a queue you cannot see is a
          queue you stop trusting. */}
      {queue.length > 0 && (
        <section className="queue" aria-label="Up next">
          <p className="queue-head">
            Up next
            <span className="queue-count">{queue.length}</span>
          </p>
          <ol className="queue-list">
            {queue.map((q, at) => {
              const from = playlistFor(q.id)
              const song = from?.songs[q.index]
              if (!song) return null
              return (
                <li key={q.id + q.index}>
                  <img src={song.thumb} alt="" loading="lazy" decoding="async" />
                  <span className="queue-text">
                    <span className="queue-title">{song.title}</span>
                    {/* Which list it came from, which only matters when
                        it is not this one. */}
                    {q.id !== id && <span className="queue-from">{from.title}</span>}
                  </span>
                  <button onClick={() => unqueue(at)} aria-label={'Remove ' + song.title}>
                    ✕
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <p className="playlist-count">
        {list.songs.length} songs
        {now.id === id ? ' · playing' : ''}
      </p>
      <ol className="playlist" ref={listEl}>
      {list.songs.map((song, i) => {
        const playing = now.id === id && now.index === i
        return (
          <li key={song.id + i} ref={playing ? here : null}>
            <button
              className={'track' + (playing ? ' is-here' : '')}
              // Tapping the row you are already on is a pause, which is
              // what everyone tries. Tapping any other row moves there.
              onClick={() => (playing ? toggle() : cue(id, i))}
              aria-current={playing ? 'true' : undefined}
            >
              {/* The row's number, until it is the one playing — then it
                  is the thing moving. Both occupy the same column so the
                  titles do not shift when a track changes. */}
              <span className="track-no" aria-hidden="true">
                {playing && now.playing ? (
                  <span className="track-bars">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  i + 1
                )}
              </span>

              <span className="track-art">
                <img src={song.thumb} alt="" loading="lazy" decoding="async" />
                <span className="track-badge" aria-hidden="true">
                  {playing && now.playing ? '⏸' : '▶'}
                </span>
              </span>
              <span className="track-text">
                <span className="track-title">{song.title}</span>
                {song.artist && <span className="track-artist">{song.artist}</span>}
              </span>
            </button>

            {/* Outside the row's button, because a button inside a button
                is not something the browser will give you. */}
            <button
              className="track-next"
              onClick={() => playNext(id, i)}
              aria-label={'Play ' + song.title + ' next'}
              title="Play next"
            >
              ⏭
            </button>
          </li>
        )
      })}
      </ol>

      <Wheel scroller={scroller} rows={list.songs.length} label={list.title} />
    </>
  )
}
