import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess as Rules } from 'chess.js'
import { bestMove, LEVELS, state } from './ai.js'
import './chess.css'

// A board you can play on.
//
// The rules and the opponent are chess.js and ai.js; this file is the
// squares, the pieces and whose turn it is. It holds a FEN string as its
// state rather than a chess.js instance, because an instance is mutable
// and React wants to be told that something changed.

// Outline glyphs for both sides, then coloured by CSS. The filled black
// glyphs (♟♜♞) render at a different weight to the white ones in most
// fonts, so a board using both looks like two different sets of pieces.
const GLYPH = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]

export default function ChessGame() {
  const [fen, setFen] = useState(() => new Rules().fen())
  const [level, setLevel] = useState('medium')
  const [from, setFrom] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [last, setLast] = useState(null)
  const history = useRef([])

  const game = useMemo(() => new Rules(fen), [fen])
  const board = game.board()
  const turn = game.turn()
  const where = useMemo(() => state(fen), [fen])

  // Where the piece you have picked up is allowed to go.
  const canGo = useMemo(() => {
    if (!from) return []
    return game.moves({ square: from, verbose: true }).map((m) => m.to)
  }, [from, game])

  // The opponent lives in a worker so that thinking does not stop the
  // page. If the browser will not give us one, it still plays — it just
  // blocks for as long as it takes.
  const brain = useRef(null)
  useEffect(() => {
    try {
      brain.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    } catch {
      brain.current = null
    }
    return () => brain.current?.terminate()
  }, [])

  const think = useCallback((at, how) => {
    return new Promise((resolve) => {
      const worker = brain.current
      if (!worker) {
        // No worker to be had, so it thinks here and the page waits.
        resolve(bestMove(at, how))
        return
      }
      const id = Math.random().toString(36).slice(2)
      const hear = (e) => {
        if (e.data.id !== id) return
        worker.removeEventListener('message', hear)
        resolve(e.data.move ?? null)
      }
      worker.addEventListener('message', hear)
      worker.postMessage({ fen: at, level: how, id })
    })
  }, [])

  // Black is the opponent. When it is black's turn and the game is still
  // going, it answers.
  useEffect(() => {
    if (turn !== 'b' || where.over) return
    let gone = false
    setThinking(true)
    think(fen, level).then((move) => {
      if (gone || !move) return setThinking(false)
      const next = new Rules(fen)
      next.move(move)
      history.current.push(fen)
      setLast({ from: move.from, to: move.to })
      setFen(next.fen())
      setThinking(false)
    })
    return () => {
      gone = true
    }
  }, [fen, turn, where.over, level, think])

  const tap = (square) => {
    if (turn !== 'w' || where.over || thinking) return
    const piece = game.get(square)

    if (from && canGo.includes(square)) {
      const next = new Rules(fen)
      // Always a queen. Under-promotion is a real move and almost never
      // the one you want; it can have a picker the first time somebody
      // asks for it.
      next.move({ from, to: square, promotion: 'q' })
      history.current.push(fen)
      setLast({ from, to: square })
      setFen(next.fen())
      setFrom(null)
      return
    }
    // Tapping your own piece picks it up; tapping it again puts it down.
    if (piece && piece.color === 'w') setFrom(square === from ? null : square)
    else setFrom(null)
  }

  const again = () => {
    history.current = []
    setLast(null)
    setFrom(null)
    setFen(new Rules().fen())
  }

  // Back goes two: your move and its answer, so you land on your turn.
  const back = () => {
    if (!history.current.length || thinking) return
    const earlier = history.current
    const to = earlier.length >= 2 ? earlier.splice(-2)[0] : earlier.pop()
    setLast(null)
    setFrom(null)
    setFen(to)
  }

  const taken = (colour) => {
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }
    const left = {}
    for (const row of board) {
      for (const p of row) if (p && p.color === colour) left[p.type] = (left[p.type] ?? 0) + 1
    }
    const out = []
    for (const type of ['q', 'r', 'b', 'n', 'p']) {
      for (let i = 0; i < start[type] - (left[type] ?? 0); i++) out.push(type)
    }
    return out
  }

  return (
    <div className="chess">
      <div className="chess-top">
        <div className="chess-levels" role="group" aria-label="How hard it plays">
          {Object.keys(LEVELS).map((name) => (
            <button
              key={name}
              type="button"
              className={'chess-level' + (level === name ? ' is-on' : '')}
              onClick={() => setLevel(name)}
              aria-pressed={level === name}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="chess-say" aria-live="polite">
          {where.over
            ? where.why === 'checkmate'
              ? where.winner === 'w'
                ? 'You won.'
                : 'It won.'
              : 'Drawn — ' + where.why + '.'
            : thinking
              ? 'Thinking…'
              : where.check
                ? turn === 'w'
                  ? 'You are in check.'
                  : 'Check.'
                : turn === 'w'
                  ? 'Your move.'
                  : '…'}
        </p>
      </div>

      <div className="chess-taken" aria-hidden="true">
        {taken('b').map((t, i) => (
          <span key={i} className="is-black">{GLYPH[t]}</span>
        ))}
      </div>

      <div className="chess-board" role="grid" aria-label="Chess board">
        {RANKS.map((rank, r) => (
          <div className="chess-rank" role="row" key={rank}>
            {FILES.map((file, f) => {
              const square = file + rank
              const piece = board[r][f]
              const dark = (r + f) % 2 === 1
              const name = piece
                ? (piece.color === 'w' ? 'white ' : 'black ') + NAMES[piece.type]
                : 'empty'
              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  className={
                    'chess-square' +
                    (dark ? ' is-dark' : '') +
                    (from === square ? ' is-held' : '') +
                    (canGo.includes(square) ? (piece ? ' is-takeable' : ' is-open') : '') +
                    (last && (last.from === square || last.to === square) ? ' is-last' : '')
                  }
                  onClick={() => tap(square)}
                  aria-label={square + ', ' + name}
                >
                  {piece && (
                    <span className={'chess-piece' + (piece.color === 'b' ? ' is-black' : '')}>
                      {GLYPH[piece.type]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="chess-taken" aria-hidden="true">
        {taken('w').map((t, i) => (
          <span key={i}>{GLYPH[t]}</span>
        ))}
      </div>

      <div className="chess-keys">
        <button type="button" onClick={back} disabled={!history.current.length || thinking}>
          Take it back
        </button>
        <button type="button" onClick={again}>
          New game
        </button>
      </div>
    </div>
  )
}

const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
