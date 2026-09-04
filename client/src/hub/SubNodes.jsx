import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { labelScaleFor } from './layout.js'

// A chapter's own branches, growing out of its node the way the chapters
// grow out of his head. Same rules one level down.
export default function SubNodes({ branches, accent, active, onPick, zoom }) {
  return (
    <group>
      {branches.map((b, i) => (
        <SubNode
          key={b.id}
          branch={b}
          index={i}
          accent={accent}
          state={!active ? 'idle' : active === b.id ? 'on' : 'off'}
          zoom={zoom}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

function SubNode({ branch, index, accent, state, onPick, zoom }) {
  const [hover, setHover] = useState(false)
  const dot = useRef()
  const line = useRef()
  const label = useRef()
  const grew = useRef(0)

  const curve = useMemo(() => {
    const mid = branch.parent.clone().lerp(branch.pos, 0.55)
    mid.x += 0.22
    mid.y += 0.12
    return new THREE.QuadraticBezierCurve3(
      branch.parent,
      mid,
      branch.pos
    ).getPoints(28)
  }, [branch])

  // They draw themselves in, staggered, so the fan reads as growing out of
  // the chapter rather than being there all along.
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.000004, Math.min(dt, 0.1))
    grew.current = Math.min(1, grew.current + dt * 1.6)
    const on = grew.current > index * 0.18

    const target = !on ? 0 : state === 'off' ? 0.12 : hover || state === 'on' ? 1 : 0.55
    const scale = !on ? 0 : state === 'off' ? 0.5 : hover || state === 'on' ? 1.5 : 1

    dot.current.scale.setScalar(
      THREE.MathUtils.lerp(dot.current.scale.x, scale, k)
    )
    dot.current.material.opacity = THREE.MathUtils.lerp(
      dot.current.material.opacity,
      on ? (state === 'off' ? 0.3 : 1) : 0,
      k
    )
    if (line.current) {
      line.current.material.opacity = THREE.MathUtils.lerp(
        line.current.material.opacity,
        target,
        k
      )
    }
    if (label.current) {
      label.current.style.opacity = (on ? (state === 'off' ? 0.35 : 1) : 0).toFixed(2)
      // Same as a chapter label: Html scales on camera distance alone, so
      // without this the sub-branch text swells while its fan contracts.
      label.current.style.scale = labelScaleFor(zoom?.current ?? 1).toFixed(3)
    }
  })

  return (
    <group>
      <Line
        ref={line}
        points={curve}
        color={accent}
        transparent
        opacity={0}
        lineWidth={state === 'on' || hover ? 2 : 1}
      />

      <mesh
        ref={dot}
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
        onClick={(e) => {
          e.stopPropagation()
          onPick(branch.id)
        }}
      >
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color={accent} transparent opacity={0} />
      </mesh>

      <Html position={branch.pos} center distanceFactor={2.6} zIndexRange={[9, 0]}>
        <button
          ref={label}
          className={'sub-label' + (hover ? ' is-hot' : '')}
          style={{ '--node': accent, opacity: 0 }}
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
