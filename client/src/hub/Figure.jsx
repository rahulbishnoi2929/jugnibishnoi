import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HEAD_R, HEAD_Y } from './layout.js'

// Placeholder standing figure, built from primitives.
//
// It is deliberately a silhouette, not an attempt at a person: a bad
// likeness reads worse than an obvious stand-in. Swap it for the scan by
// dropping the .glb in and replacing this group — HEAD_Y and HEAD_R are
// the only values the rest of the scene needs, and they live in layout.js.
//
// Built to the proportions of an adult rather than by eye. He is 1.95 tall
// against a 0.26 head, which is 7.5 heads; before this he was 5.7, and a
// figure that short-and-big-headed reads as a toy however it is lit. The
// landmarks below are the standard ones — shoulders a head and a half
// down, the crotch at half the total height, shoulders two heads wide —
// and the numbers are worked from those rather than nudged until they
// looked right.
export { HEAD_Y }

const H = 1.95 // how tall he is
const CROTCH = H / 2 // half height, which is where it falls on a person
const SHOULDER = H - HEAD_R * 2 * 1.5 // a head and a half from the top
const HAND = 0.8 // fingertips reach mid-thigh
const HALF_SHOULDER = 0.225 // two heads across, including the arms

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
        {/* head */}
        <mesh position={[0, HEAD_Y, 0]} castShadow>
          <sphereGeometry args={[HEAD_R, 32, 32]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.7} metalness={0.05} />
        </mesh>

        {/* neck */}
        <mesh position={[0, HEAD_Y - HEAD_R - 0.04, 0]}>
          <cylinderGeometry args={[0.045, 0.06, 0.1, 16]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.8} />
        </mesh>

        {/* torso, from the shoulders down to the hips */}
        <mesh ref={chest} position={[0, (SHOULDER + CROTCH) / 2, 0]} castShadow>
          <capsuleGeometry args={[0.155, SHOULDER - CROTCH - 0.31, 8, 24]} />
          <meshStandardMaterial color="#1b1d21" roughness={0.8} />
        </mesh>

        {/* shoulders. Without these the arms grow straight out of a tube,
            which is most of what made him read as a stick. */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.145, SHOULDER - 0.02, 0]} castShadow>
            <sphereGeometry args={[0.075, 20, 20]} />
            <meshStandardMaterial color="#1b1d21" roughness={0.8} />
          </mesh>
        ))}

        {/* arms — pivot at the shoulder, not the middle, so the sway reads */}
        {[
          ['armL', armL, -1],
          ['armR', armR, 1],
        ].map(([key, ref, s]) => (
          <group key={key} ref={ref} position={[s * HALF_SHOULDER, SHOULDER - 0.02, 0]}>
            <mesh position={[0, -(SHOULDER - HAND) / 2, 0]} rotation={[0, 0, s * 0.06]}>
              <capsuleGeometry args={[0.05, SHOULDER - HAND - 0.1, 6, 16]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.85} />
            </mesh>
            {/* a hand, so the arm ends rather than stopping */}
            <mesh position={[0, -(SHOULDER - HAND), 0]}>
              <sphereGeometry args={[0.052, 16, 16]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.85} />
            </mesh>
          </group>
        ))}

        {/* legs, half his height, and feet on the ground */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.082, 0, 0]}>
            <mesh position={[0, CROTCH / 2 + 0.03, 0]} castShadow>
              <capsuleGeometry args={[0.068, CROTCH - 0.13, 6, 16]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.03, 0.03]} castShadow>
              <boxGeometry args={[0.1, 0.06, 0.19]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
