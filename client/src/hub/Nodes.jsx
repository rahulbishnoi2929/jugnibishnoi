import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { HEAD_Y } from './Figure.jsx'

const HEAD = new THREE.Vector3(0, HEAD_Y + 0.06, 0)

// Chapters fan out around the head. Angles are hand-placed rather than
// evenly divided so it reads as a thought, not a pie chart.
const LAYOUT = [
  { a: -1.15, r: 2.9, y: 2.05 },
  { a: -0.55, r: 3.25, y: 2.75 },
  { a: 0.0, r: 3.05, y: 3.05 },
  { a: 0.58, r: 3.3, y: 2.7 },
  { a: 1.18, r: 2.85, y: 2.0 },
]

export default function Nodes({ chapters, onPick }) {
  const points = useMemo(
    () =>
      chapters.map((c, i) => {
        const { a, r, y } = LAYOUT[i] ?? LAYOUT[2]
        return {
          ...c,
          pos: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * 0.42 - 0.3),
        }
      }),
    [chapters]
  )

  return points.map((p, i) => <Node key={p.id} node={p} index={i} onPick={onPick} />)
}

function Node({ node, index, onPick }) {
  const [hover, setHover] = useState(false)
  const dot = useRef()
  const group = useRef()

  // A curve, not a straight line — straight spokes look like a diagram.
  const curve = useMemo(() => {
    const mid = HEAD.clone().lerp(node.pos, 0.5)
    mid.y += 0.35
    mid.x *= 1.25
    return new THREE.QuadraticBezierCurve3(HEAD, mid, node.pos).getPoints(40)
  }, [node.pos])

  useFrame((state) => {
    const t = state.clock.elapsedTime + index * 1.7
    group.current.position.y = Math.sin(t * 0.5) * 0.06
    const s = hover ? 1.6 : 1 + Math.sin(t * 1.6) * 0.08
    dot.current.scale.setScalar(THREE.MathUtils.lerp(dot.current.scale.x, s, 0.15))
  })

  return (
    <group ref={group}>
      <Line
        points={curve}
        color={node.accent}
        transparent
        opacity={hover ? 0.95 : 0.42}
        lineWidth={hover ? 2.2 : 1.1}
      />

      <mesh
        ref={dot}
        position={node.pos}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onPick(node.id)
        }}
      >
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshBasicMaterial color={node.accent} />
      </mesh>

      <Html position={node.pos} center distanceFactor={8} zIndexRange={[10, 0]}>
        <button
          className={'node-label' + (hover ? ' is-hot' : '')}
          style={{ '--node': node.accent }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => onPick(node.id)}
        >
          <span className="node-title">{node.title}</span>
          <span className="node-years">{node.years}</span>
        </button>
      </Html>
    </group>
  )
}
