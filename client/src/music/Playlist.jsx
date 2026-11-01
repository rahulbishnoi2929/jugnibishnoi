import { useEffect, useRef } from 'react'
import { playlistFor } from '../lib/playlists.js'
import { useMusic } from './context.js'

// One playlist, open. The equivalent of the photo grid under a Campus
// branch — same job, different evidence.
//
// Rows are thumbnails because that is how you recognise a song you half
// remember. They come straight off YouTube's image CDN, so a list of
// fifty costs fifty <img> tags and no API call.
export default function Playlist({ id }) {
  const list = playlistFor(id)
  const { now, cue, toggle } = useMusic()
  const here = useRef(null)

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
      <p className="playlist-count">
        {list.songs.length} songs
        {now.id === id ? ' · playing' : ''}
      </p>
      <ol className="playlist">
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
          </li>
        )
      })}
      </ol>
    </>
  )
}
