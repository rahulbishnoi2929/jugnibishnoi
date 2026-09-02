import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Placeholder standing figure, built from primitives.
//
// It is deliberately a silhouette, not an attempt at a person: a bad
// likeness reads worse than an obvious stand-in. Swap it for the scan by
// dropping the .glb in and replacing this group — HEAD_Y is the only value
// the rest of the scene needs from it.
export const HEAD_Y = 1.78

// Someone who has asked their OS for less motion should not get a figure
// spinning on the spot. They still get the breathing.
const reduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Figure({ facing }) {
  const group = useRef()
  const chest = useRef()
  const armL = useRef()
  const armR = useRef()
  const spin = useRef(0)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = 1 - Math.pow(0.004, Math.min(dt, 0.1))

    // Breathing. The old amplitude was 0.025 on a 1.8-unit figure, which
    // is invisible at any camera distance — this is the same idea, read.
    group.current.position.y = Math.sin(t * 0.9) * 0.07
    chest.current.scale.y = 1 + Math.sin(t * 0.9) * 0.022

    // At the hub he turns on the spot — a slow full revolution, so the
    // figure is visibly a three-dimensional thing rather than a cut-out.
    // Travelled, he stops and faces the branch you picked.
    if (facing) {
      const target = Math.atan2(facing.x, facing.z + 2.2)
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        target,
        k
      )
      spin.current = group.current.rotation.y
    } else {
      if (!reduced) spin.current += dt * 0.32 // ~20s per revolution
      group.current.rotation.y = spin.current
    }

    // Weight shifting from foot to foot, and arms that follow it.
    group.current.rotation.z = Math.sin(t * 0.45) * 0.016
    const sway = Math.sin(t * 0.7)
    armL.current.rotation.x = sway * 0.22
    armR.current.rotation.x = -sway * 0.22
  })

  return (
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
  )
}
