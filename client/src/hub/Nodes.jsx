import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { HEAD } from './layout.js'

export default function Nodes({ nodes, active, onPick }) {
  return (
    <group>
      {nodes.map((n, i) => (
        <Node
          key={n.id}
          node={n}
          index={i}
          state={!active ? 'idle' : active === n.id ? 'on' : 'off'}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

function Node({ node, index, state, onPick }) {
  const [hover, setHover] = useState(false)
  const dot = useRef()
  const group = useRef()
  const line = useRef()

  // A curve, not a straight spoke — straight lines look like a diagram.
  const curve = useMemo(() => {
    const mid = HEAD.clone().lerp(node.pos, 0.5)
    mid.y += 0.35
    mid.x *= 1.25
    return new THREE.QuadraticBezierCurve3(HEAD, mid, node.pos).getPoints(40)
  }, [node.pos])

  // Travelling to one branch mutes the other four rather than hiding them:
  // you should still see what you did not pick.
  const targetOpacity = state === 'off' ? 0.06 : state === 'on' ? 1 : hover ? 0.95 : 0.42
  // 'on' stays small: the camera is right next to it, so 1.6 fills the screen.
  const targetScale = state === 'off' ? 0.4 : state === 'on' ? 0.7 : hover ? 1.6 : 1

  useFrame((s, dt) => {
    const k = 1 - Math.pow(0.002, dt)
    const t = s.clock.elapsedTime + index * 1.7

    group.current.position.y = state === 'idle' ? Math.sin(t * 0.5) * 0.06 : 0
    const wobble = state === 'idle' && !hover ? Math.sin(t * 1.6) * 0.08 : 0

    dot.current.scale.setScalar(
      THREE.MathUtils.lerp(dot.current.scale.x, targetScale + wobble, k)
    )
    dot.current.material.opacity = THREE.MathUtils.lerp(
      dot.current.material.opacity,
      state === 'off' ? 0.15 : 1,
      k
    )
    if (line.current) {
      line.current.material.opacity = THREE.MathUtils.lerp(
        line.current.material.opacity,
        targetOpacity,
        k
      )
    }
  })

  return (
    <group ref={group}>
      <Line
        ref={line}
        points={curve}
        color={node.accent}
        transparent
        opacity={0.42}
        lineWidth={state === 'on' || hover ? 2.4 : 1.1}
      />

      <mesh
        ref={dot}
        position={node.pos}
        onPointerOver={(e) => {
          if (state === 'off') return
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
        <meshBasicMaterial color={node.accent} transparent opacity={1} />
      </mesh>

      {/* Once you have arrived, the panel is the title — a second one
          rendered huge in 3D is just the same word twice. */}
      <Html
        position={node.pos}
        center
        distanceFactor={8}
        zIndexRange={[10, 0]}
        style={{
          opacity: state === 'on' ? 0 : 1,
          transition: 'opacity 300ms ease',
          pointerEvents: state === 'on' ? 'none' : 'auto',
        }}
      >
        <button
          className={
            'node-label' +
            (hover ? ' is-hot' : '') +
            (state === 'off' ? ' is-muted' : '')
          }
          style={{ '--node': node.accent }}
          tabIndex={state === 'off' ? -1 : 0}
          aria-hidden={state === 'off'}
          onMouseEnter={() => state !== 'off' && setHover(true)}
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
