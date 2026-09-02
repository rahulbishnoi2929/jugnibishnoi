import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useNavigate, Link } from 'react-router-dom'
import data from '../content/chapters.json'
import Figure from './Figure.jsx'
import Nodes from './Nodes.jsx'
import '../styles/hub.css'

const chapters = data.chapters
const reduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Hub() {
  const navigate = useNavigate()
  const pick = (id) => navigate('/journey#' + id)

  return (
    <div className="hub">
      <Link className="hatch" to="/work">
        Just show me the work ↗
      </Link>

      <div className="hub-canvas">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: [0, 2.3, 7.8], fov: 40 }}
          gl={{ antialias: true }}
          // Look at the head, not the origin, or the top nodes fall off screen.
          onCreated={({ camera }) => camera.lookAt(0, 2.0, 0)}
        >
          <color attach="background" args={['#0f100d']} />
          <fog attach="fog" args={['#0f100d', 7, 15]} />

          <ambientLight intensity={0.35} />
          {/* rim light from behind, same dawn as the Soil field */}
          <directionalLight position={[-4, 5, -6]} intensity={2.6} color="#d4a72c" />
          <directionalLight position={[5, 3, 4]} intensity={0.5} color="#5b8dbe" />

          <Suspense fallback={null}>
            <Rig>
              <Figure />
              <Nodes chapters={chapters} onPick={pick} />
            </Rig>
          </Suspense>

          {/* ground: catches the figure so it is standing, not floating */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[7, 48]} />
            <meshStandardMaterial color="#15130e" roughness={1} />
          </mesh>
        </Canvas>
      </div>

      <header className="hub-copy">
        <p className="hub-eyebrow">Mehrajpur, Fazilka — Punjab</p>
        <h1 className="hub-name">Rahul Bishnoi</h1>
        <p className="hub-line">
          Twenty-three years, in five parts. Pick one.
        </p>
      </header>

      <Link className="hub-alt" to="/journey">
        Or read it start to finish →
      </Link>
    </div>
  )
}

// Mouse parallax. The camera leans, the scene never spins on its own —
// autorotate makes a page feel like a screensaver.
function Rig({ children }) {
  const g = useRef()
  useFrame((state) => {
    if (reduced) return
    const { x, y } = state.pointer
    g.current.rotation.y += (x * 0.22 - g.current.rotation.y) * 0.04
    g.current.rotation.x += (-y * 0.09 - g.current.rotation.x) * 0.04
  })
  return <group ref={g}>{children}</group>
}
