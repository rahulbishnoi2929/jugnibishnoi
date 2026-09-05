import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  placeNodes,
  placeRooms,
  placeBranches,
  HOME_VIEW,
  BRANCH_VIEW,
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
  liftFor,
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
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 520)
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
  const view = active ? BRANCH_VIEW : HOME_VIEW

  // A chapter's own branches, and which of them is open.
  const activeNode = nodes.find((n) => n.id === active)
  const branches = useMemo(
    () => (activeNode ? placeBranches(activeNode, activeNode.branches, narrow) : []),
    [activeNode, narrow]
  )
  const openSub = branches.find((b) => b.id === sub) ?? null

  const go = (next) => {
    if (!next) return navigate('/')
    const node = nodes.find((n) => n.id === next)
    navigate(node?.kind === 'link' ? node.to : '/c/' + next)
  }
  const goSub = (next) =>
    navigate(next ? '/c/' + active + '/' + next : '/c/' + active)

  // Drag to turn him — both ways. Nothing happens on hover: the
  // constellation moves when you take hold of it and not before.
  // A ref, not state: it changes every pointer move and only the render
  // loop reads it.
  const drag = useRef({ x: 0, y: 0 })
  const from = useRef(null)
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

  // Written every frame by Hud, read by nobody but the DOM.
  const caption = useRef(null)
  const title = useRef(null)
  const legend = useRef(null)
  const back = useRef(null)

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Capture, so the release reaches us even if the pointer ends up
    // outside the window. Without it a drag that left the page never
    // ended, and every later move kept turning the ring with no button
    // held down.
    // Throws NotFoundError if the id is not a live pointer, and losing the
    // handler to that would drop the gesture entirely.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: want.current }
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
    drag.current.x += (e.clientX - from.current.x) * 0.011
    // Tilt is clamped — past about 25° you are looking at the top of his
    // head and the branches collapse into a line.
    drag.current.y = THREE.MathUtils.clamp(
      drag.current.y + (e.clientY - from.current.y) * 0.007,
      -0.45,
      0.45
    )
    from.current = { x: e.clientX, y: e.clientY }
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    // One finger left after a pinch: re-anchor rather than resuming from a
    // stale point, which would snap the ring round.
    if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()]
      from.current = { ...only }
    } else if (pointers.current.size === 0) {
      from.current = null
      setDragging(false)
    }
  }

  // How far his head is off its resting height this frame. Figure writes
  // it, the branches read it.
  const bob = useRef(0)


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
  }, [active])

  // Escape is how people leave things.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (want.current > ZOOM_HUB_MAX) return void (want.current = 1)
      if (!active) return
      openSub ? goSub(null) : go(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, openSub])

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
            away={away}
            setAway={setAway}
          />

          <Suspense fallback={null}>
            <Rig frozen={!!active} drag={drag} aim={aim}>
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
                  {!active && <Globe radius={narrow ? 0.95 : 1.35} />}

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
                      facing={active ? nodes.find((n) => n.id === active)?.pos : null}
                      bob={bob}
                      scale={figureFor(narrow)}
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

      <header className="hub-copy" aria-hidden={!!active}>
        <p className="hub-eyebrow">Mehrajpur, Fazilka — Punjab</p>
        <h1 className="hub-name">Rahul Bishnoi</h1>
        <p className="hub-line">Twenty-three years, in five parts. Pick one.</p>
      </header>

      <Panel
        chapter={openSub ? { ...openSub, accent: activeNode.accent } : chapter}
        onBack={() => (openSub ? goSub(null) : go(null))}
        backLabel={openSub ? '← ' + chapter.title : '← All chapters'}
      />

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
  useFrame((state) => {
    // Straight from the eased zoom, with no second smoothing of its own.
    // It used to lerp towards its own target at its own rate while Cosmos
    // read the zoom directly, so his planet lagged behind the solar system
    // arriving around it — two things animating one gesture at two speeds,
    // which is most of what made this feel rough.
    const nest = nestFor(zoom.current)
    g.current.scale.setScalar(nest)

    // Sideways he stays at the origin, because every stage out there is
    // placed so the thing you came from lands on it. Vertically, on a phone
    // only, he sits in the upper half instead: the composition is 344px of
    // an 812px screen and centring it left 230 of empty sky above and 38
    // below, which reads as a broken layout rather than as space.
    //
    // The lift rides the nesting, so as he shrinks to a dot it shrinks with
    // him — framed for a phone while he is the subject, and landing exactly
    // on Earth by the time he is not. A fixed lift would leave him hanging
    // above the solar system.
    g.current.position.y = liftFor(state.size.width) * nest
  })
  return <group ref={g}>{children}</group>
}

// Names the scale you are at and offers the way back.
//
// Lives inside the canvas because it needs the frame loop, and writes to
// DOM nodes outside it — the same trick the branch labels use. The only
// thing it puts through React is the one flag that unmounts his planet,
// and only when it changes.
function Hud({ zoom, caption, title, legend, back, away, setAway }) {
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
      back.current.style.pointerEvents = out > 0.5 ? 'auto' : 'none'
      back.current.tabIndex = out > 0.5 ? 0 : -1
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
function Rig({ children, frozen, drag, aim }) {
  const g = useRef()
  useFrame((_, dt) => {
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
  })
  return <group ref={g}>{children}</group>
}
