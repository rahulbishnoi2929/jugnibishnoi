import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Shadow } from '@react-three/drei'
import { useNavigate, useParams, Link } from 'react-router-dom'
import * as THREE from 'three'
import data from '../content/chapters.json'
import roomData from '../content/rooms.json'
import Figure from './Figure.jsx'
import Globe from './Globe.jsx'
import Nodes from './Nodes.jsx'
import Cosmos from './Cosmos.jsx'
import SubNodes from './SubNodes.jsx'
import Panel from './Panel.jsx'
import Plate from './Plate.jsx'
import { useMusic } from '../music/context.js'
import { isPlaylist } from '../lib/playlists.js'
import {
  placeNodes,
  placeRooms,
  placeBranches,
  HOME_VIEW,
  branchView,
  coast,
  flung,
  turnRate,
  TILT_RATE,
  GLOBE_R,
  FLING_STOP,
  offerView,
  offerCard,
  spinToFront,
  applyZoom,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_HUB_MAX,
  ZOOM_RATE,
  ZOOM_EASE,
  ZOOM_SNAP,
  ZOOM_DT_MAX,
  HUB_GONE,
  STAGES,
  cosmicScale,
  figureFor,
  fitFor,
  headFor,
  nestFor,
  shrinkFor,
} from './layout.js'
import { CAPTIONS } from './cosmos.js'
import { asset } from '../lib/asset.js'
import '../styles/hub.css'

const chapters = data.chapters
const rooms = roomData.rooms
const reduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Hub() {
  const { id, sub } = useParams()
  const navigate = useNavigate()
  // Breakpoint as state, not a one-off read, so rotating the phone
  // re-lays the rings out instead of keeping portrait spacing.
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 520
  )
  // Two breakpoints, and they are not the same one. 520 is where he is
  // drawn smaller; 900 is where the reading panel stops being a column
  // down the left and becomes a sheet across the bottom (hub.css). The
  // band between them is full-size figure with a sheet, which is its own
  // composition and the one the offer view got wrong when it had two.
  const [sheet, setSheet] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 900
  )
  useEffect(() => {
    const onResize = () => {
      setNarrow(window.innerWidth < 520)
      setSheet(window.innerWidth <= 900)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const nodes = useMemo(
    () => [...placeNodes(chapters, narrow), ...placeRooms(rooms, narrow)],
    [narrow]
  )

  // He is drawn smaller on a phone, so his branches leave the top of his
  // head rather than drooping out of it, and the junction moves with him.
  const head = useMemo(() => headFor(narrow), [narrow])

  // Rooms that only route away are never a destination here.
  const openable = nodes.filter((n) => n.kind !== 'link')
  const active = openable.some((n) => n.id === id) ? id : null
  const chapter = openable.find((n) => n.id === active)
  // Music is framed differently because it behaves differently: he holds
  // the playlists out, so the camera comes in to where his hands are
  // rather than looking at a fan of branches off the ring.
  const offering = active === 'music'

  // A chapter's own branches, and which of them is open.
  const activeNode = nodes.find((n) => n.id === active)
  const branches = useMemo(
    () =>
      activeNode
        ? placeBranches(activeNode, activeNode.branches, narrow, offering, sheet)
        : [],
    [activeNode, narrow, offering, sheet]
  )
  const openSub = branches.find((b) => b.id === sub) ?? null

  // Below `branches` on purpose. The offer's framing depends on how many
  // cards there are, and reading that above here threw "cannot access
  // activeNode before initialization" — a blank page, because a temporal
  // dead zone is a runtime error and neither the build nor the geometry
  // tests ever execute this component.
  const view = useMemo(
    () =>
      offering
        ? offerView(narrow, sheet, branches.length)
        : active
          ? branchView(narrow)
          : HOME_VIEW,
    [active, offering, narrow, sheet, branches.length]
  )

  // Both are useCallback so the Escape handler can list them as the
  // dependencies they are, rather than closing over whichever render it
  // happened to be registered in.
  const go = useCallback(
    (next) => {
      if (!next) return navigate('/')
      const node = nodes.find((n) => n.id === next)
      navigate(node?.kind === 'link' ? node.to : '/c/' + next)
    },
    [nodes, navigate]
  )
  const music = useMusic()
  // Read every frame by the figure, so it must not be state: he grooves
  // while something is playing and settles when it stops.
  const vibing = useRef(false)
  vibing.current = !!music?.now?.playing
  const goSub = useCallback(
    (next) => {
      // Opening a playlist starts it. This has to happen on the tap
      // itself: a phone will not let anything make a noise except in
      // direct response to a gesture, and the tap that opened the
      // playlist is the only gesture there is.
      if (next && isPlaylist(next)) music?.open(next)
      navigate(next ? '/c/' + active + '/' + next : '/c/' + active)
    },
    [active, navigate, music]
  )

  // Drag to turn him — both ways. Nothing happens on hover: the
  // constellation moves when you take hold of it and not before.
  // A ref, not state: it changes every pointer move and only the render
  // loop reads it.
  const drag = useRef({ x: 0, y: 0 })
  const from = useRef(null)
  // How fast it was turning when the finger left, in radians a second,
  // and whether it is still carrying that.
  //
  // Without this a swipe stops dead on release, so the ring only ever
  // turns as far as one reach of a thumb and you have to swipe again, and
  // again. On a phone that is most of what makes it feel stuck.
  const fling = useRef({ x: 0, y: 0 })
  const coasting = useRef(false)
  const moved = useRef(0)
  // Radians per pixel, worked out from how big the globe actually looks.
  // Settled when a gesture starts rather than on every move, since it
  // costs a projection and only changes when the window does.
  const rate = useRef(0.011)
  const [dragging, setDragging] = useState(false)

  // Every pointer currently down, so two fingers can be told from one.
  const pointers = useRef(new Map())
  const pinch = useRef(null)

  // Two zoom values, not one: `want` is where the gesture asked to be and
  // `zoom` eases towards it. Everything downstream reads the eased one,
  // which is what lets "back to Earth" be a button rather than a minute of
  // pinching back down the ladder.
  const zoom = useRef(1)
  const want = useRef(1)

  // How far out on the ladder of scales we are, as a flag rather than a
  // number: past the solar system his planet is a speck, and unmounting it
  // takes its DOM labels with it. Only ever flips, so one render.
  const [away, setAway] = useState(false)

  // The photo you have opened, and the list the arrows walk. Null most of
  // the time; this is the only thing in the hub that sits above everything
  // else on the screen.
  const [plate, setPlate] = useState(null)

  // Written every frame by Hud, read by nobody but the DOM.
  const caption = useRef(null)
  const title = useRef(null)
  const legend = useRef(null)
  const back = useRef(null)
  const copy = useRef(null)

  // Capture is taken when a drag starts, not when a finger lands.
  //
  // It used to be taken on pointerdown, and that silently broke every click
  // in the scene. A captured pointer sends its pointerup to the capturing
  // element, so the browser fires the click on this div rather than on the
  // canvas underneath it — React Three Fiber listens on the canvas, so no
  // mesh ever saw a click, and neither did the labels. Measured: pointerdown
  // arrived, click never did.
  //
  // Held once the pointer has moved a few pixels, which is the point it
  // stops being a tap. That still buys what capture was there for — a drag
  // that leaves the window keeps sending moves and ends properly.
  // Which pointer holds the capture, not whether one does. As a boolean it
  // was only cleared when every finger had lifted, so putting a second
  // finger down and lifting the first left it stuck true — and the finger
  // still on the glass could never take capture of its own.
  const held = useRef(null)
  const travel = useRef(0)
  const grab = (e) => {
    if (held.current !== null) return
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
      held.current = e.pointerId
    } catch {}
  }

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    travel.current = 0
    // Catching it stops it, the way putting a hand on a spinning globe
    // does.
    coasting.current = false
    fling.current.x = 0
    fling.current.y = 0
    moved.current = e.timeStamp
    rate.current = turnRate(window.innerWidth, window.innerHeight)

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: want.current }
      // Two fingers are never a tap, so this one can be held at once.
      grab(e)
      // A pinch is not a drag. Drop the rotation anchor or the ring lurches
      // as the second finger lands.
      from.current = null
      setDragging(false)
    } else if (pointers.current.size === 1) {
      from.current = { x: e.clientX, y: e.clientY }
      setDragging(true)
    }
  }

  const onMove = (e) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    // Pinch: fingers apart means zoom in, and zoom is a distance
    // multiplier, so the ratio goes the other way up.
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const gap = Math.hypot(a.x - b.x, a.y - b.y)
      if (gap > 0) {
        want.current = THREE.MathUtils.clamp(
          pinch.current.zoom * (pinch.current.gap / gap),
          ZOOM_MIN,
          active ? ZOOM_HUB_MAX : ZOOM_MAX
        )
      }
      return
    }

    if (!from.current) return
    // A tap wanders a pixel or two. Past six it is a drag, and only then is
    // the pointer worth holding on to.
    travel.current += Math.abs(e.clientX - from.current.x) + Math.abs(e.clientY - from.current.y)
    if (travel.current > 6) grab(e)

    const turn = (e.clientX - from.current.x) * rate.current
    const tip = (e.clientY - from.current.y) * rate.current * TILT_RATE
    drag.current.x += turn
    // Tilt is clamped — past about 25° you are looking at the top of his
    // head and the branches collapse into a line.
    drag.current.y = THREE.MathUtils.clamp(drag.current.y + tip, -0.45, 0.45)

    // Speed, smoothed. A single pointer event is a noisy sample — a phone
    // delivers them unevenly and one slow frame reads as a stop — so this
    // follows the last few rather than the last one.
    const gap = Math.max(1, e.timeStamp - moved.current)
    moved.current = e.timeStamp
    const k = Math.min(1, gap / 90)
    fling.current.x = THREE.MathUtils.lerp(fling.current.x, (turn / gap) * 1000, k)
    fling.current.y = THREE.MathUtils.lerp(fling.current.y, (tip / gap) * 1000, k)

    from.current = { x: e.clientX, y: e.clientY }
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    // The pointer that was holding it has gone, so the next drag is free
    // to take it rather than waiting for the screen to clear.
    if (held.current === e.pointerId) held.current = null
    if (pointers.current.size < 2) pinch.current = null
    // One finger left after a pinch: re-anchor rather than resuming from a
    // stale point, which would snap the ring round.
    if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()]
      from.current = { ...only }
    } else if (pointers.current.size === 0) {
      from.current = null
      held.current = null
      // Let go and it keeps going. Only if it was actually moving: a tap
      // and a slow reposition should both end where they stopped.
      coasting.current = flung(fling.current.x, fling.current.y, rate.current)
      travel.current = 0
      setDragging(false)
    }
  }

  // How far his head is off its resting height this frame. Figure writes
  // it, the branches read it.
  const bob = useRef(0)

  // Where the turntable has got to this frame. Rig writes it; Figure reads
  // it to cancel it out, so that he keeps facing you while the ring of
  // branches turns around him.
  const spin = useRef(0)


  const canvasBox = useRef(null)
  useEffect(() => {
    const el = canvasBox.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      want.current = THREE.MathUtils.clamp(
        want.current * (1 + e.deltaY * 0.0012),
        ZOOM_MIN,
        // Leaving the planet only makes sense from the hub. Inside a
        // chapter the camera is somewhere else entirely.
        active ? ZOOM_HUB_MAX : ZOOM_MAX
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [active])

  // Where the turntable should settle. Set from the active branch rather
  // than from the click, so a pasted /c/soil link spins there too.
  const aim = useRef(null)
  useEffect(() => {
    if (!active) {
      aim.current = null
      return
    }
    // Opening a chapter from out on the ladder would leave his planet
    // unmounted and the chapter view empty, so come back in first. Only the
    // gestures were clamped, and they do not run retroactively.
    want.current = Math.min(want.current, ZOOM_HUB_MAX)
    const node = nodes.find((n) => n.id === active)
    if (node) aim.current = spinToFront(node, drag.current.x)
    // `nodes` belongs in here: it is rebuilt when the breakpoint flips, and
    // without it turning the phone while a chapter was open left the
    // turntable aimed at the angle the old ring had.
  }, [active, nodes])

  // Escape is how people leave things.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      // One handler, so the order is stated rather than left to whichever
      // listener happened to register first: the photo closes, then the
      // way back in from the cosmos, then the branch, then the chapter.
      if (plate) return setPlate(null)
      if (want.current > ZOOM_HUB_MAX) return void (want.current = 1)
      if (!active) return
      openSub ? goSub(null) : go(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, openSub, plate, go, goSub])

  return (
    <div className={'hub' + (active ? ' is-travelled' : '')}>
      <Link className="hatch" to="/work">
        Just show me the work ↗
      </Link>

      {/* The chapter's world, full bleed behind the canvas. Arriving at a
          branch should put you in the place, not show you a stamp of it. */}
      <div
        className="hub-scene"
        style={{
          backgroundImage: chapter?.scene ? `url(${asset(chapter.scene)})` : 'none',
          opacity: chapter ? 1 : 0,
        }}
      />

      <div
        ref={canvasBox}
        className={'hub-canvas' + (dragging ? ' is-dragging' : '')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: HOME_VIEW.pos.toArray(), fov: 40 }}
          // transparent so the scene behind shows through once travelled
          gl={{ antialias: true, alpha: true }}
        >

          <ambientLight intensity={0.35} />
          <directionalLight position={[-4, 5, -6]} intensity={2.6} color="#d4a72c" />
          <directionalLight position={[5, 3, 4]} intensity={0.5} color="#5b8dbe" />

          {/* Ease first, so everything else in the frame reads the zoom it
              has just settled rather than the previous frame's. */}
          <Ease zoom={zoom} want={want} />
          <Travel view={view} zoom={zoom} />
          <Hud
            zoom={zoom}
            caption={caption}
            title={title}
            legend={legend}
            back={back}
            copy={copy}
            travelled={!!active}
            away={away}
            setAway={setAway}
          />

          <Suspense fallback={null}>
            <Rig frozen={!!active} drag={drag} aim={aim} spin={spin} fling={fling} coasting={coasting}>
              {/* Keep pulling back and his planet is not the subject any
                  more. Inside the rig, so dragging turns the sky too. */}
              {!active && <Cosmos zoom={zoom} />}

              {/* Everything of his, nested inside the scale above it.
                  The ground only exists at the hub — once you have
                  travelled, the chapter's own artwork is the ground.

                  Past the first stage out there is nothing here worth
                  drawing, so it unmounts rather than fading: that takes the
                  branch labels with it, which are DOM and would otherwise
                  hang around over the sky. */}
              {!away && (
                <Nest zoom={zoom}>
                  {!active && <Globe radius={GLOBE_R(narrow)} />}

                  {/* He and his branches shrink as you zoom into the
                      planet. The globe is outside this on purpose — it is
                      the thing you are zooming towards. */}
                  <Shrink zoom={zoom}>
                    {/* Grounds him. The painted horizon in each scene does
                        not line up with the 3D floor, and without this he
                        floats. It is his, so it shrinks when he does. */}
                    <Shadow
                      position={[0, 0.015, 0]}
                      rotation={[-Math.PI / 2, 0, 0]}
                      scale={[0.32 * figureFor(narrow), 0.32 * figureFor(narrow), 1]}
                      opacity={0.55}
                      color="#000000"
                    />
                    <Figure
                      bob={bob}
                      spin={spin}
                      turned={!!active}
                      scale={figureFor(narrow)}
                      offering={offering}
                      vibe={vibing}
                    />

                    {/* Everything growing out of his head rides with it. */}
                    <Breathe bob={bob}>
                      <Nodes
                        nodes={nodes}
                        active={active}
                        onPick={go}
                        zoom={zoom}
                        head={head}
                      />

                      {branches.length > 0 && (
                        <SubNodes
                          branches={branches}
                          chapterId={active}
                          card={offering ? offerCard(narrow, sheet, branches.length) : null}
                          narrow={narrow}
                          accent={activeNode.accent}
                          active={sub}
                          zoom={zoom}
                          onPick={goSub}
                        />
                      )}
                    </Breathe>
                  </Shrink>
                </Nest>
              )}
            </Rig>
          </Suspense>

        </Canvas>
      </div>

      {/* Named as you pass it, rather than labelled in 3D — at these
          scales a label in the scene is either a speck or the whole sky. */}
      <div className="cosmos-caption" ref={caption} aria-live="polite">
        <strong className="cosmos-name" ref={title} />
        <span className="cosmos-legend" ref={legend} />
      </div>

      <button
        type="button"
        className="cosmos-back"
        ref={back}
        onClick={() => (want.current = 1)}
      >
        ↓ Back to Earth
      </button>

      <header className="hub-copy" ref={copy} aria-hidden={!!active}>
        <p className="hub-eyebrow">Mehrajpur, Fazilka — Punjab</p>
        <h1 className="hub-name">Rahul Bishnoi</h1>
        <p className="hub-line">Twenty-three years, in five parts. Pick one.</p>
      </header>

      <Panel
        chapter={openSub ? { ...openSub, accent: activeNode.accent } : chapter}
        onBack={() => (openSub ? goSub(null) : go(null))}
        backLabel={openSub ? '← ' + chapter.title : '← All chapters'}
        gallery={openSub ? { chapter: active, branch: openSub.id } : null}
        onOpenPhoto={(photo, list) => setPlate({ photo, list })}
      />

      {plate && (
        <Plate
          photo={plate.photo}
          list={plate.list}
          onClose={() => setPlate(null)}
          onMove={(photo) => setPlate((p) => ({ ...p, photo }))}
        />
      )}

      <Link className="hub-alt" to="/journey" aria-hidden={!!active}>
        Or read it start to finish →
      </Link>
    </div>
  )
}

// Flies the camera between the hub and a branch. Damping is exponential on
// delta time, so the travel takes the same wall-clock time at 30fps or 144.
function Travel({ view, zoom }) {
  const { camera } = useThree()
  const look = useRef(HOME_VIEW.look.clone())
  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())

  useFrame((state, dt) => {
    const k = reduced ? 1 : 1 - Math.pow(0.0007, Math.min(dt, 0.1))
    // A phone is far too narrow for the ring at desktop framing — Soil and
    // Grit fell off both edges. Pull back on narrow viewports. Read from
    // the canvas each frame so rotating the phone is handled for free.
    const fit = fitFor(state.size.width)
    // Capped: past the hub's own range the camera stays put and the world
    // shrinks instead. Nine thousand units of pull-back would be numerically
    // miserable and would look identical.
    const z = Math.min(zoom.current, ZOOM_HUB_MAX) * fit
    applyZoom(view, z, targetPos.current, targetLook.current)
    camera.position.lerp(targetPos.current, k)
    look.current.lerp(targetLook.current, k)
    camera.lookAt(look.current)
  })

  return null
}

// Eases the real zoom towards the one the gesture asked for.
//
// Geometrically, not linearly: zoom is a multiplier, so the same easing has
// to feel the same whether you are at 0.5 or at 400. Lerping it in a
// straight line would crawl at the near end and lurch at the far one.
function Ease({ zoom, want }) {
  useFrame((_, dt) => {
    if (reduced) {
      zoom.current = want.current
      return
    }
    const step = Math.min(dt, ZOOM_DT_MAX)
    // Worked in log-zoom throughout, because zoom is a multiplier: the same
    // easing then feels the same at 0.5 as it does at 400.
    const gap = Math.log(want.current / zoom.current)
    if (Math.abs(gap) < ZOOM_SNAP) {
      // Land exactly, or a long tail keeps the frame loop busy and the
      // caption flickering at a threshold.
      zoom.current = want.current
      return
    }
    const k = 1 - Math.pow(ZOOM_EASE, step)
    // Proportional, but never faster than the speed limit. The easing gives
    // small gestures a direct feel; the limit stops a long flick covering a
    // whole stage in one frame.
    const move = Math.sign(gap) * Math.min(Math.abs(gap) * k, ZOOM_RATE * step)
    zoom.current *= Math.exp(move)
  })
  return null
}

// His planet becoming a dot in the thing that contains it.
//
// Separate from Shrink because the globe is deliberately outside that one —
// it is what you zoom towards — but it does have to leave with him.
function Nest({ zoom, children }) {
  const g = useRef()
  useFrame(() => {
    // Straight from the eased zoom, with no second smoothing of its own.
    // It used to lerp towards its own target at its own rate while Cosmos
    // read the zoom directly, so his planet lagged behind the solar system
    // arriving around it — two things animating one gesture at two speeds,
    // which is most of what made this feel rough.
    // He stays at the origin, because every stage out there is placed so
    // the thing you came from lands on it. Nothing to follow.
    //
    // There was briefly a lift here, to fill the empty top of a phone
    // screen. It cost more than it bought: tipping the composition up
    // flattened the branch ring from 0.14 of its own width to 0.06, and
    // labels that already overlapped each other by 24 pixels went to 65.
    // Filling the top is the title block's job, and it does that from the
    // top of the page now.
    g.current.scale.setScalar(nestFor(zoom.current))
  })
  return <group ref={g}>{children}</group>
}

const smoothCopy = (x, a, b) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Names the scale you are at and offers the way back.
//
// Lives inside the canvas because it needs the frame loop, and writes to
// DOM nodes outside it — the same trick the branch labels use. The only
// thing it puts through React is the one flag that unmounts his planet,
// and only when it changes.
function Hud({ zoom, caption, title, legend, back, copy, travelled, away, setAway }) {
  const shown = useRef(null)

  useFrame(() => {
    const t = cosmicScale(zoom.current)

    // Which stage you are nearest, and how squarely you are on it. The
    // caption fades out between two of them rather than snapping over.
    const i = Math.round(t)
    const name = STAGES[i - 1]
    // Smoothstep rather than a straight ramp: a linear fade has a visible
    // corner where it starts and where it stops.
    const x = 1 - Math.min(1, Math.abs(t - i) / 0.5)
    const near = x * x * (3 - 2 * x)

    if (caption.current) {
      caption.current.style.opacity = (name ? near : 0).toFixed(3)
      if (name && shown.current !== name) {
        shown.current = name
        const [heading, sub] = CAPTIONS[name]
        title.current.textContent = heading
        legend.current.textContent = sub
      }
    }

    if (back.current) {
      // Appears as soon as you have left, not once you have arrived
      // somewhere: the worst moment to be stranded is between two scales.
      const out = THREE.MathUtils.clamp((t - 0.08) / 0.25, 0, 1)
      back.current.style.opacity = out.toFixed(3)
      // Visible for the whole fade, but only reachable once it is at
      // least half there — the stylesheet hides it to begin with, so
      // this is what brings it back.
      back.current.style.visibility = out > 0 ? 'visible' : 'hidden'
      back.current.style.pointerEvents = out > 0.5 ? 'auto' : 'none'
      back.current.tabIndex = out > 0.5 ? 0 : -1
    }

    // His name belongs to his planet, so it goes as you leave it. On a
    // phone it also sits exactly where the cosmic caption appears, and two
    // titles in one corner is worse than none.
    if (copy.current) {
      // Written inline every frame, which beats any stylesheet rule — so
      // the travelled state has to be folded in here rather than left to
      // `.is-travelled`, or his name sits on top of an open chapter.
      const here = travelled ? 0 : 1 - smoothCopy(t, 0.08, 0.55)
      copy.current.style.opacity = here.toFixed(3)
      copy.current.style.pointerEvents = here > 0.5 ? '' : 'none'
    }

    // Hysteresis, so a jitter around the threshold cannot thrash the tree.
    if (!away && t > HUB_GONE) setAway(true)
    else if (away && t < HUB_GONE - 0.1) setAway(false)
  })

  return null
}

// Scales him down as the camera closes on the planet.
//
// The camera distance already falls with zoom, so a scale of exactly zoom
// would hold his on-screen size constant. The exponent above 1 is what
// makes him actually shrink into the view rather than just stay put:
// apparent size ends up proportional to zoom^0.6.
function Shrink({ zoom, children }) {
  const g = useRef()
  useFrame(() => {
    // Also straight from the eased zoom, for the same reason as Nest.
    g.current.scale.setScalar(shrinkFor(zoom.current))
  })
  return <group ref={g}>{children}</group>
}

// Rides the figure's breathing exactly, so the point the branches spring
// from stays on his head instead of hanging in the air above or below it
// while he moves.
function Breathe({ bob, children }) {
  const g = useRef()
  useFrame(() => {
    g.current.position.y = bob.current
  })
  return <group ref={g}>{children}</group>
}

// The turntable. The figure and the branches turn together, because the
// branches grow out of his head — rotating him alone made him swivel
// inside them.
//
// Travelling spins it to put the branch you picked at the front, rather
// than returning it to neutral — otherwise picking something behind him
// left it behind him.
function Rig({ children, frozen, drag, aim, spin, fling, coasting }) {
  const g = useRef()
  useFrame((_, dt) => {
    // Coasting, if it was flung. Exponential decay rather than a fixed
    // subtraction, so a hard flick runs on for a while and a gentle one
    // settles quickly — and the same gesture feels the same whatever the
    // frame rate, which a per-frame decrement does not.
    if (coasting.current && !frozen) {
      const turn = coast(fling.current.x, dt)
      const tip = coast(fling.current.y, dt)
      drag.current.x += turn.moved
      drag.current.y = THREE.MathUtils.clamp(drag.current.y + tip.moved, -0.45, 0.45)
      fling.current.x = turn.left
      fling.current.y = tip.left
      // Stop rather than creep. Below this it is not turning, it is just
      // keeping the frame loop awake.
      if (Math.abs(turn.left) < FLING_STOP && Math.abs(tip.left) < FLING_STOP) {
        coasting.current = false
      }
    }

    // The base is the fraction of the gap still left after one second, so
    // squaring it exactly doubles the rate. 0.002 -> 0.000004.
    const k = 1 - Math.pow(0.000004, Math.min(dt, 0.1))
    const spun = frozen && aim.current !== null
    const ty = spun ? aim.current : drag.current.x
    const tx = frozen ? 0 : drag.current.y
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, ty, k)
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, tx, k)
    // Keep the drag value on the animated angle, so going back to the hub
    // carries on from where the spin left it instead of snapping.
    if (spun) drag.current.x = g.current.rotation.y
    spin.current = g.current.rotation.y
  })
  return <group ref={g}>{children}</group>
}
