import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Placeholder standing figure, built from primitives.
//
// It is deliberately a silhouette, not an attempt at a person: a bad
// likeness reads worse than an obvious stand-in. Swap it for the scan by
// dropping the .glb in and replacing this group — HEAD_Y is the only value
// the rest of the scene needs from it.
export const HEAD_Y = 1.78

export default function Figure() {
  const group = useRef()

  // Breathing. Without it the figure reads as a statue.
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.position.y = Math.sin(t * 0.6) * 0.025
    group.current.rotation.y = Math.sin(t * 0.25) * 0.08
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
      <mesh position={[0, 1.18, 0]} castShadow>
        <capsuleGeometry args={[0.21, 0.5, 8, 24]} />
        <meshStandardMaterial color="#1b1d21" roughness={0.8} />
      </mesh>

      {/* arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.27, 1.12, 0]} rotation={[0, 0, s * 0.09]}>
          <capsuleGeometry args={[0.062, 0.56, 6, 16]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.85} />
        </mesh>
      ))}

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
