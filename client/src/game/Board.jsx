import { useEffect, useRef, useState } from 'react'
import { COLS, ROWS, YOU, CPU, newBoard, drop, at, validMoves, result } from './engine.js'
import { bestMove } from './ai.js'
import './board.css'

const EMPTY = { board: newBoard(), turn: YOU, over: null, last: -1 }

export default function Board() {
  const [g, setG] = useState(EMPTY)
  const [thinking, setThinking] = useState(false)
  const timer = useRef()

  const play = (col) => {
    if (g.over || g.turn !== YOU || thinking) return
    const next = drop(g.board, col, YOU)
    if (!next) return
    setG({ board: next, turn: CPU, over: result(next), last: col })
  }

  // The computer's move. Depth 5 returns in a few ms, so the pause is
  // deliberate — an instant reply reads as "it wasn't thinking".
  useEffect(() => {
    if (g.turn !== CPU || g.over) return
    setThinking(true)
    timer.current = setTimeout(() => {
      const col = bestMove(g.board)
      if (col < 0) {
        setThinking(false)
        return
      }
      const next = drop(g.board, col, CPU)
      setG({ board: next, turn: YOU, over: result(next), last: col })
      setThinking(false)
    }, 420)
    return () => clearTimeout(timer.current)
  }, [g])

  useEffect(() => () => clearTimeout(timer.current), [])

  const winCells = g.over && g.over !== 'draw' ? g.over.cells : []
  const open = validMoves(g.board)

  const status = g.over
    ? g.over === 'draw'
      ? 'A draw. Nobody gets the last word.'
      : g.over.player === YOU
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
        <button className="cf-reset" onClick={() => setG(EMPTY)}>
          {g.over ? 'Play again' : 'Restart'}
        </button>
      </div>

      {/* Column buttons are the controls, so the whole game is keyboard
          playable by default — tab to a column, press enter. */}
      <div className="cf-cols">
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            className="cf-col"
            onClick={() => play(c)}
            disabled={!!g.over || thinking || !open.includes(c)}
            aria-label={'Drop in column ' + (c + 1)}
          >
            ↓
          </button>
        ))}
      </div>

      <div className="cf-grid" aria-label="Connect four board">
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const v = g.board[i]
          return (
            <div
              key={i}
              className={
                'cf-cell' +
                (v === YOU ? ' is-you' : v === CPU ? ' is-cpu' : '') +
                (winCells.includes(i) ? ' is-win' : '')
              }
            />
          )
        })}
      </div>

      <p className="cf-key">
        <span className="cf-dot is-you" /> you
        <span className="cf-dot is-cpu" /> me
      </p>
    </div>
  )
}
