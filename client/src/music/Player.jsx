import { useCallback, useEffect, useRef, useState } from 'react'
import { MusicContext, useMusic } from './context.js'
import { playlistFor } from '../lib/playlists.js'
import { loadYouTube } from './youtube.js'
import Waves from './Waves.jsx'
import '../styles/music.css'

// The music, and the small thing in the corner that proves it is playing.
//
// This sits above the router, which is the whole point: a song has to
// survive leaving the page it was started from. Put the player inside a
// route and navigating unmounts the iframe mid-bar.
//
// For the same reason the iframe never moves in the DOM. Re-parenting an
// iframe reloads it, so the dock is fixed where it is and the playlist
// panel is a second set of controls onto the same player rather than a
// second player.

export function MusicProvider({ children }) {
  const [now, setNow] = useState({ id: null, index: 0, playing: false })
  // Where we are in the song. Polled rather than pushed, because the
  // IFrame API has no timeupdate — four times a second is enough for a
  // bar a few hundred pixels wide and costs nothing.
  const [clock, setClock] = useState({ at: 0, of: 0 })
  const [shuffle, setShuffle] = useState(false)
  // off, then the whole list again, then this one song over and over —
  // the order every player uses, because each press is "more repetition
  // than last time".
  const [repeat, setRepeat] = useState('off')
  // Songs that jump the order. Each is a playlist and a row in it, not
  // just a row, so queuing something from Lovable while you are standing
  // in Rap plays the right song.
  const [queue, setQueue] = useState([])
  const player = useRef(null)
  const host = useRef(null)
  // The event handlers are given to YouTube once and never rebuilt, so
  // they read the current track from here rather than from a closure that
  // was correct three songs ago. Same for what counts as "next", which
  // changes when shuffle does.
  const live = useRef(now)
  live.current = now

  const list = now.id ? playlistFor(now.id) : null
  const track = list?.songs[now.index] ?? null

  useEffect(() => {
    if (!now.playing) return
    const tick = setInterval(() => {
      const p = player.current
      if (!p?.getDuration) return
      const of = p.getDuration() || 0
      setClock({ at: p.getCurrentTime() || 0, of })
    }, 250)
    return () => clearInterval(tick)
  }, [now.playing, now.index, now.id])

  const after = useRef(null)
  // What follows this track — a playlist and a row, or null for "nothing,
  // stop". `ended` is the difference between the song finishing and you
  // pressing next: repeat-one means one song forever, but next still has
  // to move or the button looks broken.
  after.current = (pid, at, ended = false) => {
    // The queue comes first, always. That is what a queue is.
    if (queue.length) return { ...queue[0], queued: true }
    const l = playlistFor(pid)
    if (!l) return null
    if (ended && repeat === 'one') return { id: pid, index: at }
    if (shuffle && l.songs.length > 1) {
      let pick = at
      while (pick === at) pick = Math.floor(Math.random() * l.songs.length)
      return { id: pid, index: pick }
    }
    if (at + 1 < l.songs.length) return { id: pid, index: at + 1 }
    return repeat === 'off' ? null : { id: pid, index: 0 }
  }

  const cue = useCallback((id, index) => {
    const pl = playlistFor(id)
    const song = pl?.songs[index]
    if (!song) return
    setNow({ id, index, playing: true })
    loadYouTube().then((YT) => {
      if (player.current) {
        player.current.loadVideoById(song.id)
        return
      }
      player.current = new YT.Player(host.current, {
        videoId: song.id,
        // playsinline matters on iOS: without it the first song hijacks
        // the screen into the fullscreen video player.
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 0 },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) {
              const { id: pid, index: at } = live.current
              const to = after.current(pid, at, true)
              if (!to) setNow((s) => ({ ...s, playing: false }))
              else {
                if (to.queued) setQueue((q) => q.slice(1))
                cue(to.id, to.index)
              }
              return
            }
            if (e.data === YT.PlayerState.PLAYING) setNow((s) => ({ ...s, playing: true }))
            if (e.data === YT.PlayerState.PAUSED) setNow((s) => ({ ...s, playing: false }))
          },
        },
      })
    })
  }, [])

  // Opening a playlist starts it. The tap that opened it is the gesture a
  // phone requires before it will let anything make a noise, so this is
  // allowed where an autoplay on page load would not be.
  const open = useCallback(
    (id) => {
      if (live.current.id === id && player.current) return
      cue(id, 0)
    },
    [cue]
  )

  const toggle = useCallback(() => {
    const p = player.current
    if (!p) return
    if (live.current.playing) p.pauseVideo()
    else p.playVideo()
  }, [])

  const step = useCallback(
    (by) => {
      const { id, index } = live.current
      const l = playlistFor(id)
      if (!l) return
      if (by > 0) {
        const to = after.current(id, index)
        if (!to) return
        if (to.queued) setQueue((q) => q.slice(1))
        cue(to.id, to.index)
        return
      }
      // Back past the first track wraps only if the list is set to.
      const at = index - 1
      if (at >= 0) cue(id, at)
      else if (repeat !== 'off') cue(id, l.songs.length - 1)
    },
    [cue, repeat]
  )

  // Added to the back of the queue, not the front.
  //
  // Most players put "play next" at the top, so pressing it on three
  // songs plays them backwards. That is defensible for one song and
  // wrong for the thing he asked for, which is building a queue: pick
  // four in the order you want them and they come out in that order.
  //
  // Queuing something already queued moves it to the back rather than
  // adding it twice, since the second press is a correction.
  const playNext = useCallback((id, index) => {
    setQueue((q) => [
      ...q.filter((e) => !(e.id === id && e.index === index)),
      { id, index },
    ])
  }, [])

  const unqueue = useCallback((at) => {
    setQueue((q) => q.filter((_, i) => i !== at))
  }, [])

  // Scrubbing. The bar reports where along it you let go, 0 to 1.
  const seek = useCallback((fraction) => {
    const p = player.current
    if (!p?.getDuration) return
    const of = p.getDuration() || 0
    if (!of) return
    p.seekTo(of * Math.min(1, Math.max(0, fraction)), true)
    setClock({ at: of * fraction, of })
  }, [])

  const stop = useCallback(() => {
    player.current?.stopVideo()
    setNow({ id: null, index: 0, playing: false })
    setClock({ at: 0, of: 0 })
    setQueue([])
  }, [])

  // Space, arrows, M. Only once something is playing, and never while
  // the caret is in a field or on a button that does its own thing with
  // the key — space on a focused button is a click, and stealing that
  // would break every control on the page.
  useEffect(() => {
    if (!track) return
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
      if (e.key === ' ' && (tag === 'BUTTON' || tag === 'A')) return
      // The photo viewer walks a set with the same two arrows. Whichever
      // is in front owns them, or one press moves a song and a
      // photograph at once.
      if (document.querySelector('[role="dialog"]')) return

      if (e.key === ' ') { e.preventDefault(); toggle() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [track, toggle, step])

  const value = {
    now, list, track, open, cue, toggle, step, stop,
    clock, seek, shuffle, setShuffle, repeat, setRepeat,
    queue, playNext, unqueue,
  }

  return (
    <MusicContext.Provider value={value}>
      {/* Behind everything, and only there while something is playing —
          the stylesheet fades it on the presence of a mood. */}
      <Waves />
      {children}
      <Dock host={host} />
    </MusicContext.Provider>
  )
}

// The thing in the corner. It is always mounted — it is the iframe's home
// — and simply has nothing to show until something is playing.
// mm:ss, and nothing fancier. A song is never an hour long.
const clockText = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0')
}

function Dock({ host }) {
  const { now, list, track, toggle, step, stop, clock, seek, shuffle, setShuffle, repeat, setRepeat } =
    useMusic()
  const on = !!track
  const through = clock.of ? clock.at / clock.of : 0

  return (
    <div className={'dock' + (on ? ' is-on' : '')} aria-hidden={!on}>
      {/* A thread of the song's progress across the very top of the dock,
          so you can read how far in you are without looking for a bar. */}
      <div className="dock-thread" style={{ '--through': through }} aria-hidden="true" />
      {/* YouTube will not play in a hidden player, and their terms ask
          that it not be obscured, so it is small and real rather than
          absent. At this size it reads as artwork. */}
      <div className="dock-screen">
        <div ref={host} />
      </div>

      <div className="dock-text">
        <p className="dock-title">{track?.title ?? ''}</p>
        <p className="dock-sub">
          {track?.artist ? track.artist + ' · ' : ''}
          {list?.title ?? ''}
        </p>

        {/* Where you are, and a way to go somewhere else in it. A player
            without this is a toy: you cannot tell a song that has just
            started from one about to end, and you cannot skip the
            ninety-second intro on a live recording. */}
        <label className="dock-seek">
          <span className="dock-time">{clockText(clock.at)}</span>
          <input
            type="range"
            min="0"
            max="1000"
            value={Math.round(through * 1000)}
            onChange={(e) => seek(Number(e.target.value) / 1000)}
            style={{ '--through': through }}
            aria-label="Seek"
          />
          <span className="dock-time">
            {clock.of ? '-' + clockText(clock.of - clock.at) : '0:00'}
          </span>
        </label>
      </div>

      <div className="dock-keys">
        <button
          className={'is-mode' + (shuffle ? ' is-lit' : '')}
          onClick={() => setShuffle((s) => !s)}
          aria-label="Shuffle"
          aria-pressed={shuffle}
        >
          ⤨
        </button>
        <button
          className={'is-mode' + (repeat !== 'off' ? ' is-lit' : '')}
          onClick={() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))}
          aria-label={
            repeat === 'off'
              ? 'Repeat off'
              : repeat === 'all'
                ? 'Repeating the playlist'
                : 'Repeating this song'
          }
        >
          {repeat === 'one' ? '🔂' : '🔁'}
        </button>
        <button
          onClick={() => step(-1)}
          aria-label="Previous song"
          disabled={now.index === 0 && !shuffle && repeat === 'off'}
        >
          ⏮
        </button>
        <button className="is-play" onClick={toggle} aria-label={now.playing ? 'Pause' : 'Play'}>
          {now.playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => step(1)}
          aria-label="Next song"
          disabled={
            !list || (!shuffle && repeat === 'off' && now.index >= list.songs.length - 1)
          }
        >
          ⏭
        </button>
        <button className="is-stop" onClick={stop} aria-label="Stop the music">
          ✕
        </button>
      </div>
    </div>
  )
}
