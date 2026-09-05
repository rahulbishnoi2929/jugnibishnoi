import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HEAD_Y } from './layout.js'

// Placeholder standing figure, built from primitives.
//
// It is deliberately a silhouette, not an attempt at a person: a bad
// likeness reads worse than an obvious stand-in. Swap it for the scan by
// dropping the .glb in and replacing this group — HEAD_Y is the only value
// the rest of the scene needs from it, and it is declared in layout.js.
export { HEAD_Y }

export default function Figure({ facing, bob, scale = 1 }) {
  const group = useRef()
  const chest = useRef()
  const armL = useRef()
  const armR = useRef()

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.1))

    // Breathing. The old amplitude was 0.025 on a 1.8-unit figure, which
    // is invisible at any camera distance — this is the same idea, read.
    const rise = Math.sin(t * 0.9) * 0.12
    group.current.position.y = rise
    // The branches grow out of his head, so they need to know where it is —
    // and in the same units, which means after his own scale.
    if (bob) bob.current = rise * scale
    chest.current.scale.y = 1 + Math.sin(t * 0.9) * 0.022

    // Turning with the cursor is the turntable's job now — he and the
    // branches move as one thing. All he does himself is face the branch
    // you travelled to.
    const target = facing ? Math.atan2(facing.x, facing.z + 2.2) : 0
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      target,
      k
    )

    // Weight shifting from foot to foot, and arms that follow it.
    group.current.rotation.z = Math.sin(t * 0.45) * 0.016
    const sway = Math.sin(t * 0.7)
    armL.current.rotation.x = sway * 0.22
    armR.current.rotation.x = -sway * 0.22
  })

  return (
    // The scale lives on an outer group so his breathing, his sway and the
    // turn to face a branch all stay in his own units — and so the rise the
    // branches follow is the rise you can see.
    <group scale={scale}>
      <group ref={group}>
        <mesh position={[0, HEAD_Y, 0]} castShadow>
          <sphereGeometry args={[0.17, 32, 32]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.7} metalness={0.05} />
        </mesh>
  
        {/* neck */}
        <mesh position={[0, 1.575, 0]}>
          <cylinderGeometry args={[0.055, 0.07, 0.11, 16]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.8} />
        </mesh>
  
        {/* torso */}
        <mesh ref={chest} position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.5, 8, 24]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.8} />
        </mesh>
  
        {/* arms — pivot at the shoulder, not the middle, so the sway reads */}
        <group ref={armL} position={[-0.27, 1.4, 0]}>
          <mesh position={[0, -0.28, 0]} rotation={[0, 0, -0.09]}>
            <capsuleGeometry args={[0.062, 0.56, 6, 16]} />
            <meshStandardMaterial color="#1b1d21" roughness={0.85} />
          </mesh>
        </group>
        <group ref={armR} position={[0.27, 1.4, 0]}>
          <mesh position={[0, -0.28, 0]} rotation={[0, 0, 0.09]}>
            <capsuleGeometry args={[0.062, 0.56, 6, 16]} />
            <meshStandardMaterial color="#1b1d21" roughness={0.85} />
          </mesh>
        </group>
  
        {/* legs */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.105, 0.42, 0]} castShadow>
            <capsuleGeometry args={[0.082, 0.66, 6, 16]} />
            <meshStandardMaterial color="#1b1d21" roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
