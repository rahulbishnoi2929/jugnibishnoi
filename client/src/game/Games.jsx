import { lazy, Suspense, useState } from 'react'
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

  if (playing) {
    const game = GAMES[playing]
    const Game = game.load
    return (
      <div className="games">
        <button type="button" className="games-back" onClick={() => setPlaying(null)}>
          ← Games
        </button>
        <Suspense fallback={<p className="games-wait">Setting out the pieces…</p>}>
          <Game />
        </Suspense>
      </div>
    )
  }

  return (
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
  )
}
