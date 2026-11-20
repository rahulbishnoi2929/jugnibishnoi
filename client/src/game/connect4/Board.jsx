import { useEffect, useState } from 'react'
import { COLS, ROWS, YOU, CPU, newBoard, drop, landingRow, validMoves, result } from './engine.js'
import { bestMove } from './ai.js'
import { useSure, useTurnClock } from '../hooks.js'
import Face from '../Face.jsx'
import './board.css'

const EMPTY = { board: newBoard(), turn: YOU, over: null, last: -1 }

// `onBusy` hears whether a game is under way, so the room around it can
// ask before throwing it away.
export default function Board({ onBusy }) {
  const [g, setG] = useState(EMPTY)
  // The column under the pointer, so you can see where a disc would land
  // before you let go of it.
  const [hover, setHover] = useState(null)

  // Every turn is timed, the same as chess. You are 'w' to the clock.
  const { clock, flag, moved, reset } = useTurnClock(!g.over)
  // Running out is a loss like any other, just with no four to light up.
  const over = flag ? { player: flag === 'w' ? CPU : YOU, cells: [], time: true } : g.over

  // Worked out, not stored. It used to be its own state, and a restart
  // during the computer's pause cancelled the move without ever setting
  // it back — the board stayed locked until you left the game.
  const thinking = g.turn === CPU && !over
  const ended = !!over

  const busy = g.board.some(Boolean) && !over
  useEffect(() => onBusy?.(busy), [busy, onBusy])
  const [armed, guard] = useSure()

  const play = (col) => {
    if (over || g.turn !== YOU) return
    const next = drop(g.board, col, YOU)
    if (!next) return
    const res = result(next)
    setG({ board: next, turn: CPU, over: res, last: col })
    moved(!!res)
  }

  // The computer's move. Depth 5 returns in a few ms, so the pause is
  // deliberate — an instant reply reads as "it wasn't thinking".
  useEffect(() => {
    if (g.turn !== CPU || ended) return
    const t = setTimeout(() => {
      const col = bestMove(g.board)
      if (col < 0) return
      const next = drop(g.board, col, CPU)
      const res = result(next)
      setG({ board: next, turn: YOU, over: res, last: col })
      moved(!!res)
    }, 420)
    return () => clearTimeout(t)
    // `moved` is a new function every render, and the clock redraws ten
    // times a second: depending on it would restart the pause forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, ended])

  const again = () => {
    setG(EMPTY)
    reset()
  }

  const winCells = over && over !== 'draw' ? over.cells : []
  const open = validMoves(g.board)
  const canPlay = !over && !thinking

  // Where your disc would land, shown faintly.
  const ghost =
    canPlay && hover != null && open.includes(hover)
      ? landingRow(g.board, hover) * COLS + hover
      : -1
  // The disc that has just been played: the top one in the last column.
  // It falls in from above the board, further the lower it lands.
  let fresh = -1
  if (g.last >= 0) {
    for (let r = 0; r < ROWS; r++) {
      if (g.board[r * COLS + g.last]) {
        fresh = r * COLS + g.last
        break
      }
    }
  }

  const status = over
    ? over === 'draw'
      ? 'A draw. Nobody gets the last word.'
      : over.time
        ? over.player === YOU
          ? 'I ran out of time. You win.'
          : 'You ran out of time.'
        : over.player === YOU
          ? 'You win.'
          : 'I win. Again?'
    : thinking
      ? 'Thinking…'
      : 'Your turn.'

  return (
    <div className="cf">
      <div className="cf-head">
        <p className="cf-status" role="status" aria-live="polite">
          {status}
        </p>
        <button className="cf-reset" onClick={guard('restart', busy, again)}>
          {over ? 'Play again' : armed === 'restart' ? 'Sure? Tap again' : 'Restart'}
        </button>
      </div>

      {/* Column buttons are the controls, so the whole game is keyboard
          playable by default — tab to a column, press enter. */}
      <div onMouseLeave={() => setHover(null)}>
        <div className="cf-cols">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              className={'cf-col' + (hover === c && canPlay ? ' is-hover' : '')}
              onClick={() => play(c)}
              onMouseEnter={() => setHover(c)}
              onFocus={() => setHover(c)}
              onBlur={() => setHover(null)}
              disabled={!!over || thinking || !open.includes(c)}
              aria-label={'Drop in column ' + (c + 1)}
            >
              ↓
            </button>
          ))}
        </div>

        {/* The cells take a click as well: aiming at the column you mean is
          easier than aiming at the little arrow above it. The arrows stay
          the keyboard's way in. */}
        <div className={'cf-grid' + (canPlay ? ' is-yours' : '')} aria-label="Connect four board">
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const v = g.board[i]
            return (
              <div
                key={i}
                className={
                  'cf-cell' +
                  (v === YOU ? ' is-you' : v === CPU ? ' is-cpu' : '') +
                  (winCells.includes(i) ? ' is-win' : '') +
                  (i === ghost ? ' is-ghost' : '') +
                  (i === fresh ? ' is-fresh' : '')
                }
                style={i === fresh ? { '--fall': Math.floor(i / COLS) + 1 } : undefined}
                onClick={() => play(i % COLS)}
                onMouseEnter={() => setHover(i % COLS)}
              />
            )
          })}
        </div>
      </div>

      <p className="cf-key">
        <span className="cf-dot is-you" /> you
        <Face clock={clock} side="w" live={clock.turn === 'w' && !over} />
        <span className="cf-dot is-cpu" /> me
        <Face clock={clock} side="b" live={clock.turn === 'b' && !over} />
      </p>
    </div>
  )
}
