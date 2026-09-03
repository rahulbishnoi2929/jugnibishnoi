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
import SubNodes from './SubNodes.jsx'
import Panel from './Panel.jsx'
import { placeNodes, placeRooms, placeBranches, HOME_VIEW, BRANCH_VIEW, spinToFront } from './layout.js'
import '../styles/hub.css'

const chapters = data.chapters
const rooms = roomData.rooms
const reduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Hub() {
  const { id, sub } = useParams()
  const navigate = useNavigate()
  const nodes = useMemo(() => [...placeNodes(chapters), ...placeRooms(rooms)], [])

  // Rooms that only route away are never a destination here.
  const openable = nodes.filter((n) => n.kind !== 'link')
  const active = openable.some((n) => n.id === id) ? id : null
  const chapter = openable.find((n) => n.id === active)
  const view = active ? BRANCH_VIEW : HOME_VIEW

  // A chapter's own branches, and which of them is open.
  const activeNode = nodes.find((n) => n.id === active)
  const branches = useMemo(
    () => (activeNode ? placeBranches(activeNode, activeNode.branches) : []),
    [activeNode]
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

  const onDown = (e) => {
    if (e.button !== 0) return
    from.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onMove = (e) => {
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
  const onUp = () => {
    from.current = null
    setDragging(false)
  }

  // How far his head is off its resting height this frame. Figure writes
  // it, the branches read it.
  const bob = useRef(0)

  // Where the turntable should settle. Set from the active branch rather
  // than from the click, so a pasted /c/soil link spins there too.
  const aim = useRef(null)
  useEffect(() => {
    if (!active) {
      aim.current = null
      return
    }
    const node = nodes.find((n) => n.id === active)
    if (node) aim.current = spinToFront(node, drag.current.x)
  }, [active])

  // Escape is how people leave things.
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
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
          backgroundImage: chapter?.scene ? `url(${chapter.scene})` : 'none',
          opacity: chapter ? 1 : 0,
        }}
      />

      <div
        className={'hub-canvas' + (dragging ? ' is-dragging' : '')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
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

          <Travel view={view} />

          <Suspense fallback={null}>
            <Rig frozen={!!active} drag={drag} aim={aim}>
              {/* Grounds him. The painted horizon in each scene does not line
                  up with the 3D floor, and without this he floats. */}
              <Shadow
                position={[0, 0.015, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[0.85, 0.85, 1]}
                opacity={0.55}
                color="#000000"
              />
              <Figure
                facing={active ? nodes.find((n) => n.id === active)?.pos : null}
                bob={bob}
              />

              {/* Everything growing out of his head rides with it. */}
              <Breathe bob={bob}>
                <Nodes nodes={nodes} active={active} onPick={go} />

                {branches.length > 0 && (
                  <SubNodes
                    branches={branches}
                    accent={activeNode.accent}
                    active={sub}
                    onPick={goSub}
                  />
                )}
              </Breathe>
            </Rig>
          </Suspense>

          {/* The ground only exists at the hub. Once you have travelled, the
              chapter's own artwork is the ground, and this drew across it. */}
          {!active && <Globe />}
        </Canvas>
      </div>

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
function Travel({ view }) {
  const { camera } = useThree()
  const look = useRef(HOME_VIEW.look.clone())

  useFrame((_, dt) => {
    const k = reduced ? 1 : 1 - Math.pow(0.0007, Math.min(dt, 0.1))
    camera.position.lerp(view.pos, k)
    look.current.lerp(view.look, k)
    camera.lookAt(look.current)
  })

  return null
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
