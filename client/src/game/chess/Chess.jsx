import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess as Rules } from 'chess.js'
import { bestMove, LEVELS, state } from './ai.js'
import { CONTROLS, budget, controlOf, flagged, left, newClock, press, show, start, stop } from './clock.js'
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

export default function ChessGame() {
  const [fen, setFen] = useState(() => new Rules().fen())
  const [level, setLevel] = useState('medium')
  const [from, setFrom] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [last, setLast] = useState(null)
  const history = useRef([])

  // The clock. `tick` exists only to make the component redraw four
  // times a second — the time itself is worked out from the clock and
  // the moment you ask, never counted down in storage, so a backgrounded
  // tab that stops firing timers does not gain you a minute.
  const [control, setControl] = useState('off')
  const [clock, setClock] = useState(() => newClock(null))
  const [, setTick] = useState(0)
  const flag = useRef(null)

  const game = useMemo(() => new Rules(fen), [fen])
  const board = game.board()
  const turn = game.turn()
  const rules = useMemo(() => state(fen), [fen])
  // A game is also over when somebody runs out of time, and that is not
  // something chess.js can know.
  const where = flag.current
    ? { over: true, winner: flag.current === 'w' ? 'b' : 'w', why: 'time' }
    : rules

  const running = clock.turn != null && !where.over

  // One loop: redraw the faces, and notice when one of them has run out.
  //
  // The flag check lives here rather than in an effect of its own
  // because the clock object only changes when somebody moves. Watching
  // it for a flag therefore never fires while time is merely passing,
  // which is the only way a clock ever actually runs out — the time hit
  // zero, went red, and the game carried on as though nothing had
  // happened.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const out = flagged(clock, Date.now())
      if (out) {
        flag.current = out
        setClock((c) => stop(c, Date.now()))
      }
      setTick((n) => n + 1)
    }, 100)
    return () => clearInterval(id)
  }, [running, clock])

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
      setClock((c) => press(c, Date.now()))
      setThinking(false)
    })
    return () => {
      gone = true
    }
    // The clock is read when this runs, not depended on: adding it would
    // restart the opponent's thinking four times a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // The first move starts the clock — your thinking before it is
      // free — and every move after it is a press.
      //
      // Whether the clock has started is a question the clock can answer,
      // so nothing is remembered here. It used to set a ref inside this
      // updater, which React's StrictMode calls twice precisely to catch:
      // the second call saw the ref already set, took the other branch,
      // and returned a clock that had never started. React keeps the
      // second answer, so the clock never ran.
      setClock((c) => (c.turn == null ? start(c, 'b', Date.now()) : press(c, Date.now())))
      return
    }
    // Tapping your own piece picks it up; tapping it again puts it down.
    if (piece && piece.color === 'w') setFrom(square === from ? null : square)
    else setFrom(null)
  }

  const again = (id = control) => {
    history.current = []
    flag.current = null
    setLast(null)
    setFrom(null)
    setFen(new Rules().fen())
    setClock(newClock(controlOf(id).ms))
  }

  const pickControl = (id) => {
    setControl(id)
    // Changing the clock starts the game again: carrying a half-played
    // position onto a new time control is nobody's idea of either game.
    again(id)
  }

  // Back goes two: your move and its answer, so you land on your turn.
  const back = () => {
    if (!history.current.length || thinking || where.over) return
    const earlier = history.current
    const to = earlier.length >= 2 ? earlier.splice(-2)[0] : earlier.pop()
    setLast(null)
    setFrom(null)
    setFen(to)
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
            >
              {name}
            </button>
          ))}
        </div>
        <div className="chess-pills" role="group" aria-label="Time control">
          {CONTROLS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={'chess-pill is-clock' + (control === c.id ? ' is-on' : '')}
              onClick={() => pickControl(c.id)}
              aria-pressed={control === c.id}
              aria-label={c.name}
              title={c.name}
            >
              {c.label}
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
                  aria-label={square + ', ' + name}
                >
                  {f === 0 && <span className="chess-coord is-rank">{rank}</span>}
                  {r === 7 && <span className="chess-coord is-file">{file}</span>}
                  {piece && <Piece type={piece.type} color={piece.color} />}
                </button>
              )
            })}
          </div>
        ))}

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
          <button type="button" onClick={back} disabled={!history.current.length || thinking || where.over}>
            Take back
          </button>
          <button type="button" onClick={() => again()}>
            New game
          </button>
        </div>
      </div>
    </div>
  )
}

const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
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
        {thinking && <span className="chess-dots" aria-hidden="true"><i /><i /><i /></span>}
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

// One side's clock. Nothing here counts: it asks what is left at the
// moment it draws, which is why a backgrounded tab cannot gain you time.
function Face({ clock, side, live }) {
  const ms = left(clock, side, Date.now())
  if (ms == null) return null
  return (
    <span
      className={'chess-face' + (live ? ' is-live' : '') + (ms < 20_000 ? ' is-low' : '')}
      aria-label={(side === 'w' ? 'Your' : "Rahul's") + ' time'}
    >
      {show(ms)}
    </span>
  )
}
