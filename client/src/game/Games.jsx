import { lazy, Suspense, useState } from 'react'
import { useMusic } from '../music/context.js'
import { playlists } from '../lib/playlists.js'
import { useSure } from './hooks.js'
import './games.css'

// The games room: pick one, play it.
//
// Each game is loaded only when it is chosen. Chess brings chess.js and a
// worker with it, and none of that should be in the bundle for somebody
// who came to read about farming.
const GAMES = {
  chess: {
    title: 'Chess',
    note: 'Against me, three levels of me.',
    load: lazy(() => import('./chess/Chess.jsx')),
  },
  connect4: {
    title: 'Connect Four',
    note: 'Four in a row. Harder than it looks.',
    load: lazy(() => import('./connect4/Board.jsx')),
  },
}

export default function Games() {
  const [playing, setPlaying] = useState(null)
  // Whether the game on the table has moves on it and is not finished,
  // as the game itself reports it. Leaving then takes two taps.
  const [busy, setBusy] = useState(false)
  const [armed, guard] = useSure()

  const leave = () => {
    setBusy(false)
    setPlaying(null)
  }

  if (playing) {
    const game = GAMES[playing]
    const Game = game.load
    return (
      <div className="games">
        <div className="games-bar">
          <button type="button" className="games-back" onClick={guard('back', busy, leave)}>
            {armed === 'back' ? 'Leave and lose this game? Tap again' : '← Games'}
          </button>
          <Tunes />
        </div>
        <Suspense fallback={<p className="games-wait">Setting out the pieces…</p>}>
          <Game onBusy={setBusy} />
        </Suspense>
      </div>
    )
  }

  return (
    <>
      <Tunes />
      <ul className="games-list">
        {Object.entries(GAMES).map(([id, game]) => (
          <li key={id}>
            <button type="button" className="games-pick" onClick={() => setPlaying(id)}>
              <span className="games-title">{game.title}</span>
              <span className="games-note">{game.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

// Something to play to. The site's own playlists, through the same
// player as everywhere else — so the song carries on when you leave the
// game, and the dock in the corner still controls it.
function Tunes() {
  const music = useMusic()
  if (!music) return null
  const { now, track, cue, toggle } = music
  const pick = (id) => {
    const list = playlists.find((p) => p.id === id)
    // Somewhere in the list rather than always its first song: the first
    // song of a playlist you game to every evening wears out fast.
    if (list?.songs.length) cue(id, Math.floor(Math.random() * list.songs.length))
  }
  return (
    <div className="games-music">
      <select
        value={now.id ?? ''}
        onChange={(e) => pick(e.target.value)}
        aria-label="Music while you play"
      >
        <option value="" disabled>
          ♪ Music
        </option>
        {playlists
          .filter((p) => p.songs.length)
          .map((p) => (
            <option key={p.id} value={p.id}>
              ♪ {p.title}
            </option>
          ))}
      </select>
      {track && (
        <>
          <button type="button" onClick={toggle} aria-label={now.playing ? 'Pause' : 'Play'}>
            {now.playing ? '❚❚' : '▶'}
          </button>
          <span className="games-song">{track.title}</span>
        </>
      )}
    </div>
  )
}
