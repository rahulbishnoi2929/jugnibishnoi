import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { branchCurve, cardFor, headFor, labelScaleFor } from './layout.js'
import { setsFor } from '../lib/media.js'
import { playlistFor } from '../lib/playlists.js'
import { coverCrop, previewMaterial } from './shaders.js'

// A chapter's own branches, growing out of its node the way the chapters
// grow out of his head — but these are rectangles with a photograph in
// them rather than dots, because by this point there is something to show.
//
// The picture in each one changes every couple of seconds, crossfading
// rather than cutting, so a branch shows you what is behind it instead of
// one frozen frame. Six per branch at most: they are 480px thumbnails, so
// six is about 45KB and a manageable number of textures.
//
// The size comes from layout.js and differs by viewport, because these sit
// much nearer the camera than the point it is aimed at — see cardFor.
//
// They hang over his head on both screens, on branches drawn from that
// head, so the row reads as growing out of him rather than floating above
// him. On a desktop they used to be a column beside him, which is not what
// a branch off a head does.
const HOLD = 2.0 // seconds on each picture
const FADE = 0.7 // seconds to cross from one to the next
const MOST = 6 // how many of a branch's photographs to cycle through

// Scratch for the billboarding, so the frame loop allocates nothing.
const _parent = new THREE.Quaternion()
const _face = new THREE.Quaternion()

export default function SubNodes({ branches, chapterId, narrow, accent, active, onPick, zoom, card: given }) {
  const card = given ?? cardFor(narrow, branches.length)
  return (
    <group>
      {branches.map((b, i) => (
        <SubNode
          key={b.id}
          branch={b}
          index={i}
          chapterId={chapterId}
          card={card}
          narrow={narrow}
          accent={tintFor(b.id, accent)}
          state={!active ? 'idle' : active === b.id ? 'on' : 'off'}
          zoom={zoom}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

// A playlist wears its own mood rather than the chapter's pink, so the six
// of them tell you what they are before you have opened any. Same six
// values the stylesheet uses for --mood-ink; they live in both places
// because one is CSS and the other is a three.js material.
const MOOD_INK = {
  disco: '#ff4d9d',
  calm: '#6fd3c7',
  warm: '#ffa07a',
  memory: '#d9b26a',
  hard: '#c8f03c',
  still: '#8d93a8',
}
const tintFor = (id, fallback) => MOOD_INK[playlistFor(id)?.mood] ?? fallback

function SubNode({ branch, index, chapterId, card: size, narrow, accent, state, onPick, zoom }) {
  const W = size.w
  const H = size.h
  const [hover, setHover] = useState(false)
  const card = useRef()
  const frame = useRef()
  const line = useRef()
  const label = useRef()
  const grew = useRef(0)

  // What this branch has to show, up to six of them. A branch with nothing
  // in it yet still gets a frame — an empty one, which is honest.
  const urls = useMemo(() => {
    // A playlist shows its songs' artwork, which YouTube already has —
    // same rectangle, same two-second cycle, different evidence. This is
    // what a Campus branch does with photographs.
    const playlist = playlistFor(branch.id)
    if (playlist) return playlist.songs.slice(0, MOST).map((s) => s.thumb)

    const all = setsFor(chapterId, branch.id).flatMap((set) => set.photos)
    // Spread across the whole branch rather than the first six, so a
    // preview samples the set instead of showing the start of it.
    const step = Math.max(1, Math.floor(all.length / MOST))
    return all.filter((_, i) => i % step === 0).slice(0, MOST).map((p) => p.thumb)
  }, [chapterId, branch.id])

  const maps = usePictures(urls)
  const material = useMemo(() => previewMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  const shown = useRef({ at: 0, a: 0, b: 1 })

  // The branch itself, drawn from his head rather than from the chapter
  // node the rectangle hangs off.
  //
  // The node was the obvious start and it is the wrong one: it sits inside
  // the row's own vertical band — the inner two rectangles have their top
  // edges above it — so a line out of it runs across its neighbours.
  // Sampled at 48 points along each curve against every other rectangle,
  // starting from the node put 39 of those points inside a picture on a
  // desktop and 42 on a phone. From his head: zero, on both.
  //
  // It also lands on the bottom edge of its own rectangle instead of the
  // middle, since a line into the centre of a photograph is a line over a
  // photograph. And it is the same branchCurve the chapters grow out of his
  // head with, so these read as more of the same tree rather than as a
  // second kind of line.
  const curve = useMemo(() => {
    const end = branch.pos.clone()
    end.y -= H / 2
    return branchCurve(headFor(narrow), end, 40)
  }, [branch, H, narrow])

  // The frame around the picture, as a closed loop.
  const outline = useMemo(() => {
    const x = W / 2
    const y = H / 2
    return [
      new THREE.Vector3(-x, -y, 0),
      new THREE.Vector3(x, -y, 0),
      new THREE.Vector3(x, y, 0),
      new THREE.Vector3(-x, y, 0),
      new THREE.Vector3(-x, -y, 0),
    ]
  }, [W, H])

  useFrame((state3, dt) => {
    const k = 1 - Math.pow(0.000004, Math.min(dt, 0.1))
    grew.current = Math.min(1, grew.current + dt * 1.6)
    const on = grew.current > index * 0.18

    const lit = !on ? 0 : state === 'off' ? 0.25 : hover || state === 'on' ? 1 : 0.85
    const size = !on ? 0 : hover || state === 'on' ? 1.06 : 1

    // Square on to the camera whatever the turntable is doing. A picture
    // seen edge-on is not a picture.
    if (card.current?.parent) {
      card.current.parent.getWorldQuaternion(_parent)
      _face.copy(_parent).invert().multiply(state3.camera.quaternion)
      card.current.quaternion.copy(_face)
      if (frame.current) frame.current.quaternion.copy(_face)
    }

    card.current.scale.setScalar(THREE.MathUtils.lerp(card.current.scale.x, size, k))
    card.current.material.opacity = THREE.MathUtils.lerp(
      card.current.material.opacity,
      lit,
      k
    )
    if (frame.current) {
      frame.current.scale.copy(card.current.scale)
      frame.current.material.opacity = THREE.MathUtils.lerp(
        frame.current.material.opacity,
        lit * (hover || state === 'on' ? 0.9 : 0.35),
        k
      )
    }
    if (line.current) {
      line.current.material.opacity = THREE.MathUtils.lerp(
        line.current.material.opacity,
        !on ? 0 : state === 'off' ? 0.12 : hover || state === 'on' ? 0.6 : 0.4,
        k
      )
    }
    if (label.current) {
      // Clickability follows visibility, the same way the chapter labels
      // do it: these are at 0 for the first half-second while the row
      // staggers in, and an invisible button is still a button.
      const shown = on ? (state === 'off' ? 0.35 : 1) : 0
      label.current.style.opacity = shown.toFixed(2)
      const live = shown > 0.05
      label.current.style.pointerEvents = live ? 'auto' : 'none'
      label.current.tabIndex = live ? 0 : -1
      label.current.setAttribute('aria-hidden', live ? 'false' : 'true')
      label.current.style.scale = labelScaleFor(zoom?.current ?? 1).toFixed(3)
    }

    // Turn the page every couple of seconds, crossfading.
    // Eased the same way the frame around it is, so the picture and its
    // border arrive together rather than one after the other.
    const u = material.uniforms
    u.uOpacity.value = THREE.MathUtils.lerp(u.uOpacity.value, lit, k)
    if (maps.length === 0) return
    if (maps.length === 1) {
      u.uA.value = u.uB.value = maps[0]
      coverCrop(maps[0].image, W / H, u.uCropA.value)
      u.uCropB.value.copy(u.uCropA.value)
      u.uMix.value = 0
      return
    }

    const s = shown.current
    s.at += dt
    if (s.at > HOLD + FADE) {
      s.at -= HOLD + FADE
      s.a = s.b
      s.b = nextLoaded(maps, s.b)
    }
    const a = maps[s.a] ?? maps[nextLoaded(maps, -1)]
    const b = maps[s.b] ?? a
    u.uA.value = a
    u.uB.value = b
    coverCrop(a.image, W / H, u.uCropA.value)
    coverCrop(b.image, W / H, u.uCropB.value)
    // Held, then eased across. smoothstep so neither end of the cross is a
    // corner you can see.
    const t = THREE.MathUtils.clamp((s.at - HOLD) / FADE, 0, 1)
    u.uMix.value = t * t * (3 - 2 * t)
  })

  const pick = (e) => {
    e.stopPropagation()
    onPick(branch.id)
  }

  return (
    <group>
      {/* No branch on the offer. He is holding these out, and a line
          from his head to something in his own hand is not a branch, it
          is a tangle. */}
      {!branch.offered && (
        <Line
          ref={line}
          points={curve}
          color={accent}
          transparent
          opacity={0}
          lineWidth={state === 'on' || hover ? 2 : 1}
        />
      )}

      <mesh
        ref={card}
        position={branch.pos}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        onClick={pick}
      >
        <planeGeometry args={[W, H]} />
        {maps.length > 0 ? (
          <primitive object={material} attach="material" />
        ) : (
          <meshBasicMaterial color="#14161a" transparent opacity={0} />
        )}
      </mesh>

      {/* The edge of the frame, which is what makes it read as a picture
          rather than as a floating rectangle of colour.
          drei's Line rather than a raw <line> with an inline
          bufferAttribute: the pane this was written in cannot render a
          frame, so an untested JSX shape would go out unverified. */}
      <Line
        ref={frame}
        points={outline}
        position={branch.pos}
        color={accent}
        transparent
        opacity={0}
        lineWidth={state === 'on' || hover ? 1.6 : 1}
      />

      {/* On a desktop the name hangs under its picture: the row clears his
          crown by 156 pixels, so there is room for one. On a phone it sits
          along the bottom edge of the picture instead — there the row ends
          12 pixels above his head and a name underneath lands on his
          face. */}
      <Html
        position={[
          branch.pos.x,
          branch.pos.y - H / 2 + (narrow ? 0.07 : -0.09),
          branch.pos.z,
        ]}
        center
        distanceFactor={2.6}
        zIndexRange={[9, 0]}
        // Same reason as the chapter labels: the wrapper is a real div and
        // must not sit on the photograph it is naming.
        style={{ pointerEvents: 'none' }}
      >
        <button
          ref={label}
          className={
            'sub-label' + (hover ? ' is-hot' : '') + (narrow ? ' is-on-photo' : '')
          }
          style={{ '--node': accent, opacity: 0 }}
          // Starting values only; the frame loop owns these. See Nodes.
          tabIndex={-1}
          aria-hidden="true"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => onPick(branch.id)}
        >
          {branch.title}
        </button>
      </Html>
    </group>
  )
}

// The next slot that has actually loaded, wrapping. The array is as long
// as the branch's list of photographs and fills in as they arrive, so it
// has holes in it until the last one lands.
function nextLoaded(maps, from) {
  for (let i = 1; i <= maps.length; i++) {
    const j = (from + i + maps.length) % maps.length
    if (maps[j]) return j
  }
  return from
}

// The pictures on one branch, cycling.
//
// Loaded by hand rather than through useLoader, because useLoader suspends
// and a preview that has not loaded should be an empty frame rather than a
// hole in the scene while everything waits for it.
function usePictures(urls) {
  const [maps, setMaps] = useState([])

  useEffect(() => {
    if (!urls.length) return
    let live = true
    const loader = new THREE.TextureLoader()
    const loaded = []
    urls.forEach((url, i) => {
      loader.load(url, (map) => {
        if (!live) return
        map.colorSpace = THREE.SRGBColorSpace
        loaded[i] = map
        // A copy with its holes kept, so each picture stays in the slot it
        // was asked for. It used to be compacted with filter(Boolean),
        // which renumbered every slot each time one arrived out of order —
        // the cycle jumped about while the set was still loading.
        setMaps(loaded.slice())
      })
    })
    return () => {
      live = false
      loaded.forEach((m) => m?.dispose())
    }
  }, [urls])

  return maps
}
