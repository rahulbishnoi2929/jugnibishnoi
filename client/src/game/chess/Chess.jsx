import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess as Rules } from 'chess.js'
import { bestMove, LEVELS, state } from './ai.js'
import { budget, left } from '../clock.js'
import Face from '../Face.jsx'
import { useSure, useTurnClock } from '../hooks.js'
import Piece from './Piece.jsx'
import './chess.css'

// A board you can play on.
//
// The rules and the opponent are chess.js and ai.js; this file is the
// squares, the pieces and whose turn it is. It holds a FEN string as its
// state rather than a chess.js instance, because an instance is mutable
// and React wants to be told that something changed.

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]
const START = new Rules().fen()

// `onBusy` hears whether a game is under way, so the room around it can
// ask before throwing it away.
export default function ChessGame({ onBusy }) {
  const [fen, setFen] = useState(START)
  const [level, setLevel] = useState('medium')
  const [from, setFrom] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [last, setLast] = useState(null)
  // A pawn on the last rank, waiting for you to say what it becomes.
  const [promo, setPromo] = useState(null)
  // A piece being dragged: where it came from and where the pointer is.
  const [drag, setDrag] = useState(null)
  const press = useRef(null)
  const history = useRef([])

  const game = useMemo(() => new Rules(fen), [fen])
  const board = game.board()
  const turn = game.turn()
  const rules = useMemo(() => state(fen), [fen])
  // Every turn is timed, yours and the opponent's alike.
  const { clock, flag, moved, reset } = useTurnClock(!rules.over)
  // A game is also over when somebody runs out of time, and that is not
  // something chess.js can know.
  const where = flag ? { over: true, winner: flag === 'w' ? 'b' : 'w', why: 'time' } : rules

  // Once a move is on the board the game is something to lose, so the
  // level stops changing under it and leaving asks first.
  const busy = fen !== START && !where.over
  useEffect(() => onBusy?.(busy), [busy, onBusy])
  const [armed, guard] = useSure()

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
      brain.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      })
    } catch {
      brain.current = null
    }
    return () => brain.current?.terminate()
  }, [])

  const think = useCallback((at, how, ms, past) => {
    return new Promise((resolve) => {
      const worker = brain.current
      if (!worker) {
        // No worker to be had, so it thinks here and the page waits.
        resolve(bestMove(at, how, Math.random, ms, past))
        return
      }
      const id = Math.random().toString(36).slice(2)
      const hear = (e) => {
        if (e.data.id !== id) return
        worker.removeEventListener('message', hear)
        resolve(e.data.move ?? null)
      }
      worker.addEventListener('message', hear)
      worker.postMessage({ fen: at, level: how, ms, history: past, id })
    })
  }, [])

  // Black is the opponent. When it is black's turn and the game is still
  // going, it answers — on its own clock, which is what stops it playing
  // beautifully and losing on time.
  useEffect(() => {
    if (turn !== 'b' || where.over) return
    let gone = false
    setThinking(true)
    const spend = budget(LEVELS[level].ms, left(clock, 'b', Date.now()))
    // Every position before this one, so it can see a repetition coming.
    think(fen, level, spend, history.current.slice()).then((move) => {
      if (gone || !move) return setThinking(false)
      const next = new Rules(fen)
      next.move(move)
      history.current.push(fen)
      setLast({ from: move.from, to: move.to })
      setFen(next.fen())
      moved(state(next.fen()).over)
      setThinking(false)
    })
    // A new game, or a flag, while it is still thinking: the answer is
    // thrown away when it comes, and the board is yours again now rather
    // than whenever the worker gets round to finishing.
    return () => {
      gone = true
      setThinking(false)
    }
    // The clock is read when this runs, not depended on: adding it would
    // restart the opponent's thinking four times a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, turn, where.over, level, think])

  // Your move, made. A pawn reaching the far rank stops here and asks
  // what it should become, rather than always being a queen.
  const play = (to, promotion) => {
    const pawn = game.get(from)?.type === 'p' && (to[1] === '8' || to[1] === '1')
    if (pawn && !promotion) return setPromo({ to })
    const next = new Rules(fen)
    next.move({ from, to, promotion })
    history.current.push(fen)
    setLast({ from, to })
    setFen(next.fen())
    setFrom(null)
    setPromo(null)
    moved(state(next.fen()).over)
  }

  const yours = turn === 'w' && !where.over && !thinking

  const tap = (square) => {
    if (!yours || promo) return
    // The click that ends a drag lands on the square it started from.
    if (press.current?.dragged) {
      press.current = null
      return
    }
    const piece = game.get(square)
    if (from && canGo.includes(square)) return play(square)
    // Tapping your own piece picks it up; tapping it again puts it down.
    if (piece && piece.color === 'w') setFrom(square === from ? null : square)
    else setFrom(null)
  }

  // Dragging, alongside tapping. A press only becomes a drag once it has
  // moved a few pixels, so a tap is still a tap.
  const down = (e, square) => {
    if (!yours || promo || game.get(square)?.color !== 'w') return
    press.current = { square, x: e.clientX, y: e.clientY, dragged: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    const p = press.current
    if (!p) return
    if (!p.dragged && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return
    if (!p.dragged) {
      p.dragged = true
      setFrom(p.square)
    }
    // Drawn inside the board, so placed relative to it, and the size of
    // a square so it does not shrink or grow as it leaves one.
    const box = e.currentTarget.closest('.chess-board').getBoundingClientRect()
    setDrag({
      square: p.square,
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      size: box.width / 8,
    })
  }
  const up = (e) => {
    const p = press.current
    if (!p?.dragged) {
      press.current = null
      return
    }
    setDrag(null)
    const to = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-square]')
      ?.dataset.square
    if (to && to !== p.square && canGo.includes(to)) play(to)
  }

  const again = () => {
    history.current = []
    setPromo(null)
    setLast(null)
    setFrom(null)
    setFen(START)
    reset()
  }

  // What a side has lost, best first, and what that is worth.
  const lost = (colour) => {
    const start = { q: 1, r: 2, b: 2, n: 2, p: 8 }
    const have = {}
    for (const row of board) {
      for (const p of row) if (p && p.color === colour) have[p.type] = (have[p.type] ?? 0) + 1
    }
    const out = []
    for (const type of Object.keys(start)) {
      for (let i = 0; i < start[type] - (have[type] ?? 0); i++) out.push(type)
    }
    return out
  }
  const lostW = lost('w')
  const lostB = lost('b')
  // Ahead by, in the usual pawn = 1 points. Counted off the board rather
  // than from what was taken, so a promotion counts as the queen it became.
  let lead = 0
  for (const row of board) {
    for (const p of row) if (p) lead += (p.color === 'w' ? 1 : -1) * (POINTS[p.type] ?? 0)
  }

  // The king that is in check, if one is — red under it, which is the
  // first thing anybody looks for and was not there at all.
  let checked = null
  if (game.inCheck()) {
    for (const row of board) {
      for (const p of row) if (p && p.type === 'k' && p.color === turn) checked = p.square
    }
  }

  const say = where.over
    ? where.why === 'time'
      ? where.winner === 'w'
        ? 'Rahul ran out of time. You won.'
        : 'You ran out of time.'
      : where.why === 'checkmate'
        ? where.winner === 'w'
          ? 'Checkmate. You won.'
          : 'Checkmate. Rahul won.'
        : 'Drawn — ' + where.why + '.'
    : thinking
      ? 'Thinking…'
      : where.check
        ? turn === 'w'
          ? 'You are in check.'
          : 'Check.'
        : turn === 'w'
          ? 'Your move.'
          : '…'

  return (
    <div className="chess">
      <div className="chess-top">
        <div className="chess-pills" role="group" aria-label="How hard it plays">
          {Object.keys(LEVELS).map((name) => (
            <button
              key={name}
              type="button"
              className={'chess-pill' + (level === name ? ' is-on' : '')}
              onClick={() => setLevel(name)}
              aria-pressed={level === name}
              disabled={busy}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <Player
        name="Rahul"
        note={level}
        colour="b"
        took={lostW}
        lead={-lead}
        thinking={thinking}
        face={<Face clock={clock} side="b" live={clock.turn === 'b' && !where.over} />}
      />

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
                    (last && (last.from === square || last.to === square) ? ' is-last' : '') +
                    (checked === square ? ' is-check' : '') +
                    (piece?.color === 'w' && turn === 'w' && !where.over ? ' is-mine' : '')
                  }
                  onClick={() => tap(square)}
                  onPointerDown={(e) => down(e, square)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={() => {
                    press.current = null
                    setDrag(null)
                  }}
                  data-square={square}
                  aria-label={square + ', ' + name}
                >
                  {f === 0 && <span className="chess-coord is-rank">{rank}</span>}
                  {r === 7 && <span className="chess-coord is-file">{file}</span>}
                  {piece && (
                    <Piece
                      type={piece.type}
                      color={piece.color}
                      className={drag?.square === square ? 'is-lifted' : ''}
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {drag && (
          <Piece
            type={game.get(drag.square)?.type}
            color="w"
            className="is-dragged"
            style={{
              left: drag.x,
              top: drag.y,
              width: drag.size,
              height: drag.size,
            }}
          />
        )}

        {promo && !where.over && (
          <div className="chess-over">
            <div className="chess-card">
              <p className="chess-why">Promote to</p>
              <div className="chess-promo" role="group" aria-label="Promote to">
                {['q', 'r', 'b', 'n'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => play(promo.to, t)}
                    aria-label={NAMES[t]}
                  >
                    <Piece type={t} color="w" />
                  </button>
                ))}
              </div>
              <button type="button" className="chess-again" onClick={() => setPromo(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {where.over && (
          <div className="chess-over">
            <div className="chess-card">
              <p className="chess-result">
                {where.winner === 'w' ? 'You won' : where.winner === 'b' ? 'Rahul won' : 'Drawn'}
              </p>
              <p className="chess-why">
                {where.why === 'time'
                  ? 'on time'
                  : where.why === 'checkmate'
                    ? 'by checkmate'
                    : 'by ' + where.why}
              </p>
              <button type="button" className="chess-again" onClick={() => again()}>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>

      <Player
        name="You"
        colour="w"
        took={lostB}
        lead={lead}
        face={<Face clock={clock} side="w" live={clock.turn === 'w' && !where.over} />}
      />

      <div className="chess-foot">
        <p className="chess-say" aria-live="polite">
          {say}
        </p>
        <div className="chess-keys">
          <button type="button" onClick={guard('new', busy, again)}>
            {armed === 'new' ? 'Resign? Tap again' : 'New game'}
          </button>
        </div>
      </div>
    </div>
  )
}

const NAMES = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
}
const POINTS = { q: 9, r: 5, b: 3, n: 3, p: 1 }

// One side of the table: who, what they have taken, and their clock.
// `took` is the other side's pieces, so they are drawn in its colour.
function Player({ name, note, colour, took, lead, thinking, face }) {
  const other = colour === 'w' ? 'b' : 'w'
  return (
    <div className="chess-player">
      <span className={'chess-avatar is-' + colour} aria-hidden="true">
        <Piece type="k" color={colour} />
      </span>
      <span className="chess-who">
        <b>{name}</b>
        {note && <small>{note}</small>}
        {thinking && (
          <span className="chess-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </span>
      <span className="chess-took" aria-hidden="true">
        {took.map((t, i) => (
          <Piece key={i} type={t} color={other} className={took[i + 1] !== t ? 'is-last-of' : ''} />
        ))}
        {lead > 0 && <em>+{lead}</em>}
      </span>
      {face}
    </div>
  )
}
