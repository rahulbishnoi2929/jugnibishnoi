import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Shadow } from '@react-three/drei'
import { useNavigate, useParams, Link } from 'react-router-dom'
import * as THREE from 'three'
import data from '../content/chapters.json'
import roomData from '../content/rooms.json'
import Figure from './Figure.jsx'
import Nodes from './Nodes.jsx'
import Panel from './Panel.jsx'
import { placeNodes, placeRooms, HOME_VIEW, viewFor } from './layout.js'
import '../styles/hub.css'

const chapters = data.chapters
const rooms = roomData.rooms
const reduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Hub() {
  const { id } = useParams()
  const navigate = useNavigate()
  const nodes = useMemo(() => [...placeNodes(chapters), ...placeRooms(rooms)], [])

  // Rooms that only route away are never a destination here.
  const openable = nodes.filter((n) => n.kind !== 'link')
  const active = openable.some((n) => n.id === id) ? id : null
  const chapter = openable.find((n) => n.id === active)
  const view = active ? viewFor(nodes.find((n) => n.id === active)) : HOME_VIEW

  const go = (next) => {
    if (!next) return navigate('/')
    const node = nodes.find((n) => n.id === next)
    navigate(node?.kind === 'link' ? node.to : '/c/' + next)
  }

  // Escape is how people leave things.
  useEffect(() => {
    if (!active) return
    const onKey = (e) => e.key === 'Escape' && go(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

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

      <div className="hub-canvas">
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
            <Rig frozen={!!active}>
              {/* Grounds him. The painted horizon in each scene does not line
                  up with the 3D floor, and without this he floats. */}
              <Shadow
                position={[0, 0.015, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[0.85, 0.85, 1]}
                opacity={0.55}
                color="#000000"
              />
              <Figure facing={active ? nodes.find((n) => n.id === active)?.pos : null} />
              <Nodes nodes={nodes} active={active} onPick={go} />
            </Rig>
          </Suspense>

          {/* Ground exists only at the hub. Once you have travelled, the
              chapter's own artwork is the ground, and this drew a brown
              band across it. */}
          {!active && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[7, 48]} />
              <meshStandardMaterial color="#15130e" roughness={1} />
            </mesh>
          )}
        </Canvas>
      </div>

      <header className="hub-copy" aria-hidden={!!active}>
        <p className="hub-eyebrow">Mehrajpur, Fazilka — Punjab</p>
        <h1 className="hub-name">Rahul Bishnoi</h1>
        <p className="hub-line">Twenty-three years, in five parts. Pick one.</p>
      </header>

      <Panel chapter={chapter} onBack={() => go(null)} />

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

// Mouse parallax, but only at the hub. Once you have travelled somewhere,
// the scene holds still so the text is readable.
function Rig({ children, frozen }) {
  const g = useRef()
  useFrame((state, dt) => {
    if (reduced) return
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.1))
    const tx = frozen ? 0 : state.pointer.x * 0.22
    const ty = frozen ? 0 : -state.pointer.y * 0.09
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, tx, k)
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, ty, k)
  })
  return <group ref={g}>{children}</group>
}
