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
  const player = useRef(null)
  const host = useRef(null)
  // The event handlers are given to YouTube once and never rebuilt, so
  // they read the current track from here rather than from a closure that
  // was correct three songs ago. Same for what counts as "next", which
  // changes when shuffle does.
  const live = useRef(now)
  live.current = now
  const after = useRef(null)
  after.current = (l, at) => {
    if (shuffle && l.songs.length > 1) {
      let pick = at
      while (pick === at) pick = Math.floor(Math.random() * l.songs.length)
      return pick
    }
    return at + 1 < l.songs.length ? at + 1 : null
  }

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

  // The site takes its mood from whatever is playing. Written to the root
  // element so every stylesheet can see it, and cleared when the music
  // stops — he asked for it to stop only when someone stops it, so this
  // follows the music rather than the page you happen to be on.
  useEffect(() => {
    const root = document.documentElement
    if (list) root.dataset.mood = list.mood
    else delete root.dataset.mood
    return () => delete root.dataset.mood
  }, [list])

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
              const l = playlistFor(pid)
              if (!l) return
              const to = after.current(l, at)
              if (to === null) setNow((s) => ({ ...s, playing: false }))
              else cue(pid, to)
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
      // Forward on shuffle means somewhere else, not the next row.
      if (by > 0 && shuffle) {
        const to = after.current(l, index)
        if (to !== null) cue(id, to)
        return
      }
      const at = index + by
      if (at >= 0 && at < l.songs.length) cue(id, at)
    },
    [cue, shuffle]
  )

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
  }, [])

  const value = {
    now, list, track, open, cue, toggle, step, stop,
    clock, seek, shuffle, setShuffle,
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
  const { now, list, track, toggle, step, stop, clock, seek, shuffle, setShuffle } = useMusic()
  const on = !!track
  const through = clock.of ? clock.at / clock.of : 0

  return (
    <div className={'dock' + (on ? ' is-on' : '')} aria-hidden={!on}>
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
          className={'is-shuffle' + (shuffle ? ' is-lit' : '')}
          onClick={() => setShuffle((s) => !s)}
          aria-label="Shuffle"
          aria-pressed={shuffle}
        >
          ⤨
        </button>
        <button
          onClick={() => step(-1)}
          aria-label="Previous song"
          disabled={now.index === 0 && !shuffle}
        >
          ⏮
        </button>
        <button className="is-play" onClick={toggle} aria-label={now.playing ? 'Pause' : 'Play'}>
          {now.playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => step(1)}
          aria-label="Next song"
          disabled={!list || (!shuffle && now.index >= list.songs.length - 1)}
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
