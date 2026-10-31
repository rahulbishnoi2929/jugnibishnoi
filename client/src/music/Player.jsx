import { useCallback, useEffect, useRef, useState } from 'react'
import { MusicContext, useMusic } from './context.js'
import { playlistFor } from '../lib/playlists.js'
import { loadYouTube } from './youtube.js'
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
  const player = useRef(null)
  const host = useRef(null)
  // The event handlers are given to YouTube once and never rebuilt, so
  // they read the current track from here rather than from a closure that
  // was correct three songs ago.
  const live = useRef(now)
  live.current = now

  const list = now.id ? playlistFor(now.id) : null
  const track = list?.songs[now.index] ?? null

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
              if (l && at + 1 < l.songs.length) cue(pid, at + 1)
              else setNow((s) => ({ ...s, playing: false }))
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
      const at = index + by
      if (at >= 0 && at < l.songs.length) cue(id, at)
    },
    [cue]
  )

  const stop = useCallback(() => {
    player.current?.stopVideo()
    setNow({ id: null, index: 0, playing: false })
  }, [])

  const value = { now, list, track, open, cue, toggle, step, stop }

  return (
    <MusicContext.Provider value={value}>
      {children}
      <Dock host={host} />
    </MusicContext.Provider>
  )
}

// The thing in the corner. It is always mounted — it is the iframe's home
// — and simply has nothing to show until something is playing.
function Dock({ host }) {
  const { now, list, track, toggle, step, stop } = useMusic()
  const on = !!track

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
      </div>

      <div className="dock-keys">
        <button onClick={() => step(-1)} aria-label="Previous song" disabled={now.index === 0}>
          ⏮
        </button>
        <button className="is-play" onClick={toggle} aria-label={now.playing ? 'Pause' : 'Play'}>
          {now.playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => step(1)}
          aria-label="Next song"
          disabled={!list || now.index >= list.songs.length - 1}
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
