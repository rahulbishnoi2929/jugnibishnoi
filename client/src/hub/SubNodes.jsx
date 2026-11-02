import { useEffect, useMemo, useRef, useState } from 'react'

// How the ring moves.
//
// A flick glides for about a second and a half rather than a tenth, and
// what is drawn trails where the finger has put it — closely while you
// are holding it, loosely once you let go, so it comes to rest instead
// of stopping.
const FLICK_TIME = 0.55 // seconds for a flick to fall to a third of itself
const FLICK_STOP = 0.015 // radians a second, below which it has stopped
const FOLLOW_HELD = 0.07 // seconds for the drawn ring to catch the finger
const FOLLOW_FREE = 0.22 // ... and to settle onto a slot
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  branchCurve,
  cardFor,
  headFor,
  labelScaleFor,
  ringAt,
  ringLevelOf,
  ringOf,
  ringRest,
  ringRise,
  ringSlotOf,
  ringSlots,
} from './layout.js'
import { setsFor } from '../lib/media.js'
import { playlistFor } from '../lib/playlists.js'
import { LABEL_MAX_CSS } from './layout.js'
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
const _spin = new THREE.Quaternion()
const _where = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _face = new THREE.Quaternion()

export default function SubNodes({
  branches,
  chapterId,
  narrow,
  accent,
  active,
  onPick,
  zoom,
  card: given,
  sheet,
  carousel,
}) {
  // The playlists are a ring you turn; everything else is a fan of
  // photographs that stays where it is put.
  const ring = !!carousel && branches.length > 0 && !!branches[0]?.offered
  const wheel = useMemo(() => ringOf(narrow, sheet), [narrow, sheet])
  const card = ring ? wheel.card : given ?? cardFor(narrow, branches.length)

  // Open a playlist by its own address and the ring is still showing
  // whatever was at the front — so it turns to the one you asked for,
  // the short way round.
  useEffect(() => {
    if (!ring || !carousel || !active) return
    const i = branches.findIndex((b) => b.id === active)
    if (i < 0) return
    const step = (Math.PI * 2) / ringSlots(branches.length)
    const want = ringSlotOf(i) * step
    const now = carousel.current.turn
    carousel.current.turn = now + Math.atan2(Math.sin(want - now), Math.cos(want - now))
    carousel.current.spin = 0
  }, [active, branches, ring, carousel])

  // One loop for the whole ring rather than one per card: where it is
  // going, what is left of a flick, and how it gets there are properties
  // of the ring, not of any card on it.
  //
  // Two numbers, not one. `turn` is where the ring is meant to be — the
  // finger sets it, a flick carries it, a release rounds it to a slot.
  // `at` is where it is actually drawn, and it only ever eases towards
  // `turn`. Everything the ring does therefore arrives through the same
  // easing, which is what stops it feeling like a mechanism: before this
  // the flick died in a tenth of a second and the snap in less, so a
  // drag ended by stopping dead and the card jumped square.
  useFrame((s, dt) => {
    if (!ring || !carousel) return
    const step = Math.min(dt, 0.05)
    const c = carousel.current

    if (!c.held) {
      if (Math.abs(c.spin) > FLICK_STOP) {
        // The exact integral of a speed decaying towards nothing, so the
        // same flick travels the same distance at 30 frames a second as
        // at 144.
        const fade = Math.exp(-step / FLICK_TIME)
        c.turn += c.spin * FLICK_TIME * (1 - fade)
        c.spin *= fade
      } else {
        c.spin = 0
        // Where a drag leaves it is rarely a slot, so this is the one
        // place the target is rounded; the easing below does the moving.
        //
        // Unconditionally, not just when a flick has run out. A slow drag
        // ends with no speed at all, so keying this to a flick dying left
        // the ring stopped between two slots with nothing square to the
        // front — which is most of the drags anyone actually makes.
        c.turn = ringRest(ringSlots(branches.length), c.turn)
      }
    }

    const tau = c.held ? FOLLOW_HELD : FOLLOW_FREE
    c.at += (c.turn - c.at) * (1 - Math.exp(-step / tau))
  })

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
          count={branches.length}
          onPick={onPick}
          ring={ring ? wheel : null}
          carousel={carousel}
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
  intense: '#ff5a3c',
  favourite: '#9d8cff',
  iconic: '#ffb000',
  party: '#3ad6ff',
}
const tintFor = (id, fallback) => MOOD_INK[playlistFor(id)?.mood] ?? fallback

function SubNode({ branch, index, chapterId, card: size, narrow, accent, state, onPick, zoom, count, ring, carousel }) {
  const W = size.w
  const H = size.h
  // A name under its picture needs a gap under the picture. Nine cards
  // are stacked three deep with no such gap, so the name goes on the art
  // — the same thing a phone already does, for the same reason: there is
  // something directly below it that the name would otherwise land on.
  const onArt = narrow
  const [hover, setHover] = useState(false)
  const card = useRef()
  const frame = useRef()
  const line = useRef()
  const label = useRef()
  // Everything that belongs to one card moves together, so the ring
  // turns a group rather than three things that have to agree.
  const slot = useRef()
  // How much of this card is facing you, and how far round it is.
  // Written by the frame loop, read by the fades and by the click.
  const ringShow = useRef(1)
  const ringAngle = useRef(0)
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
    // They arrive one after another, spread across the whole of `grew`
    // rather than a fixed step each.
    //
    // It was index * 0.18, which is fine until there are seven of them:
    // grew is capped at 1 and the seventh needed 1.08, so the playlist
    // you were actually in was the one card that never appeared. A delay
    // measured as a fraction of however many there are cannot do that.
    const on = grew.current >= (count > 1 ? index / (count - 1) : 0) * 0.85

    // Where this card sits on the ring, and how much of it is facing
    // you. The two are the same question — both are how far it has been
    // turned from the front — so they are answered together, before
    // anything below reads them.
    //
    // The ring is a thing in the room rather than a thing on the
    // turntable, so the turntable's rotation is taken back out of both
    // the position and the facing. Without that it swings round with the
    // ring of chapters and the front of it ends up behind him.
    if (ring && carousel && slot.current?.parent) {
      const seat = ringAt(ringSlotOf(index), ringSlots(count), carousel.current.at, ring)
      slot.current.parent.getWorldQuaternion(_parent)
      _face.copy(_parent).invert()
      _where
        .set(
          seat.pos[0],
          seat.pos[1] + ringRise(ringLevelOf(index), ring),
          seat.pos[2]
        )
        .applyQuaternion(_face)
      slot.current.position.copy(_where)
      _spin.setFromAxisAngle(_up, seat.turnY).premultiply(_face)
      slot.current.quaternion.copy(_spin)
      slot.current.visible = seat.show > 0.01
      ringShow.current = seat.show
      ringAngle.current = seat.angle
    }

    const facing = ring ? ringShow.current : 1
    const lit =
      (!on ? 0 : state === 'off' ? 0.25 : hover || state === 'on' ? 1 : 0.85) * facing
    const size = !on ? 0 : hover || state === 'on' ? 1.06 : 1

    // Square on to the camera whatever the turntable is doing. A picture
    // seen edge-on is not a picture — but on the ring that is the whole
    // point of the ones at the side, so there the card keeps the angle
    // its slot gives it.
    if (!ring && card.current?.parent) {
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
      const shown = (on ? (state === 'off' ? 0.35 : 1) : 0) * (ring ? ringShow.current : 1)
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
    // On the ring, only the card at the front opens. Clicking one at the
    // side brings it round — which is what you meant by clicking it, and
    // saves opening a playlist you only half saw.
    if (ring && carousel) {
      const step = (Math.PI * 2) / ringSlots(count)
      if (Math.abs(ringAngle.current) > step * 0.5) {
        carousel.current.spin = 0
        carousel.current.turn += ringAngle.current
        return
      }
    }
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

      <group ref={slot} position={branch.pos}>
      <mesh
        ref={card}
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
          0,
          -H / 2 + (onArt || ring ? H * 0.42 : -0.09),
          ring ? 0.002 : 0,
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
            'sub-label' +
            (hover ? ' is-hot' : '') +
            (onArt ? ' is-on-photo' : '') +
            (count > 8 ? ' is-tight' : '')
          }
          // Held to a width the sweep also knows about, so the spacing
          // between cards can be chosen with the names in mind rather
          // than in spite of them.
          style={{
            '--node': accent,
            opacity: 0,
            // A width, not a cap: drei's wrapper shrinks to fit its
            // contents, so a cap plus break-anywhere collapsed every name
            // to one letter per line.
            width: count > 6 ? LABEL_MAX_CSS + 'px' : undefined,
          }}
          // Starting values only; the frame loop owns these. See Nodes.
          tabIndex={-1}
          aria-hidden="true"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          // Through the same rule as the card: a name at the side of the
          // ring turns it rather than opening what you cannot see yet.
          onClick={pick}
        >
          {branch.title}
        </button>
      </Html>
      </group>
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
