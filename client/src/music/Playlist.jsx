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
        const here = now.id === id && now.index === i
        return (
          <li key={song.id + i}>
            <button
              className={'track' + (here ? ' is-here' : '')}
              // Tapping the row you are already on is a pause, which is
              // what everyone tries. Tapping any other row moves there.
              onClick={() => (here ? toggle() : cue(id, i))}
              aria-current={here ? 'true' : undefined}
            >
              <span className="track-art">
                <img src={song.thumb} alt="" loading="lazy" decoding="async" />
                <span className="track-badge" aria-hidden="true">
                  {here && now.playing ? '⏸' : '▶'}
                </span>
              </span>
              <span className="track-text">
                <span className="track-title">{song.title}</span>
                {song.artist && <span className="track-artist">{song.artist}</span>}
              </span>
              {here && now.playing && (
                <span className="track-bars" aria-label="Playing">
                  <i /><i /><i />
                </span>
              )}
            </button>
          </li>
        )
      })}
      </ol>
    </>
  )
}
