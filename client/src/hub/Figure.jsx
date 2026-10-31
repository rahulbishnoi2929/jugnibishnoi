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
const H = 1.95 // how tall he is
const CROTCH = H / 2 // half height, which is where it falls on a person
const SHOULDER = H - HEAD_R * 2 * 1.5 // a head and a half from the top
const HAND = 0.8 // fingertips reach mid-thigh
const HALF_SHOULDER = 0.225 // two heads across, including the arms

// How far an arm swings forward to hold something out. Measured rather
// than eyeballed: at -1.3 radians the hand lands at y 1.34, z 0.73 in his
// own units, which is chest height and far enough in front to put a card
// on. Lower and he is pointing at the floor; higher and he is surrendering.
const OFFER_ARM = -0.95
// And spread, so the two hands are not one hand. The sign matters and is
// easy to get backwards: Euler XYZ applies the z turn first, so on the
// arm at negative x a positive z swings the hand *inward*. Measured at
// 0.26 the two palms ended up five centimetres apart, which is cupping
// rather than offering.
const OFFER_OUT = 0.62

export default function Figure({ bob, spin, turned, scale = 1, offering, vibe }) {
  const group = useRef()
  const chest = useRef()
  const armL = useRef()
  const armR = useRef()
  const head = useRef()
  const hips = useRef()
  // Both eased rather than switched, because the whole point of the pose
  // is the moving into it. Held as refs so neither costs a render.
  const open = useRef(0)
  const groove = useRef(0)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.1))
    open.current = THREE.MathUtils.lerp(open.current, offering ? 1 : 0, k)
    // Slower in than out: arriving at a groove should feel like settling
    // into it, and stopping the music should stop him fairly promptly.
    const toward = vibe?.current ? 1 : 0
    groove.current = THREE.MathUtils.lerp(
      groove.current,
      toward,
      1 - Math.pow(toward ? 0.25 : 0.02, Math.min(dt, 0.1))
    )
    const g = groove.current

    // Breathing, and on top of it the bounce. 0.86 Hz is a slow nod —
    // somewhere near 50 to the bar, which is vibing rather than dancing.
    // He was asked to move slowly, and a figure made of capsules looks
    // foolish doing anything else.
    const beat = t * 5.4
    const rise =
      Math.sin(t * 0.9) * 0.12 + g * Math.abs(Math.sin(beat)) * 0.055 - g * 0.02
    group.current.position.y = rise
    // The branches grow out of his head, so they need to know where it is —
    // and in the same units, which means after his own scale.
    if (bob) bob.current = rise * scale
    chest.current.scale.y = 1 + Math.sin(t * 0.9) * 0.022

    // Inside a chapter he keeps facing you while the ring turns around him.
    //
    // The turntable is what moves — it spins to bring the branch you picked
    // to the front, and he is inside it, so he was being carried round with
    // it. For Campus that is -144 degrees, which is most of the way to his
    // back. He used to add a turn of his own on top, computed from the
    // branch's position *before* the spin, which put him 44 degrees the
    // other way and left him 100 degrees off. Taking that away only made it
    // the full 144.
    //
    // What cancels it is the turntable's own angle, so that is what he
    // reads. At the hub he turns with it, because there the whole
    // constellation is a thing you take hold of and spin.
    group.current.rotation.y = turned ? -(spin?.current ?? 0) : 0

    // Weight shifting from foot to foot, and arms that follow it.
    group.current.rotation.z = Math.sin(t * 0.45) * 0.016 + g * Math.sin(beat / 2) * 0.07

    // Weight going from one foot to the other, which is what a body
    // actually does to a beat and what the shoulders-only version missed.
    if (hips.current) hips.current.position.x = g * Math.sin(beat / 2) * 0.035

    // A nod, a half-beat behind the bounce so it reads as following the
    // music rather than being wound by the same crank.
    if (head.current) {
      head.current.rotation.x = g * Math.sin(beat - 0.6) * 0.1
      head.current.rotation.z = g * Math.sin(beat / 2 + 0.4) * 0.06
    }

    const sway = Math.sin(t * 0.7)
    // Idle: arms hang and swing a little. Offering: they come up and out,
    // palms where a card can sit. The groove rides on top of whichever
    // pose he is in, so he keeps the cards up while he moves.
    const idleX = sway * 0.22
    armL.current.rotation.x = THREE.MathUtils.lerp(idleX, OFFER_ARM, open.current)
      + g * Math.sin(beat) * 0.05
    armR.current.rotation.x = THREE.MathUtils.lerp(-idleX, OFFER_ARM, open.current)
      + g * Math.sin(beat + Math.PI) * 0.05
    armL.current.rotation.z = open.current * -OFFER_OUT
    armR.current.rotation.z = open.current * OFFER_OUT
  })

  return (
    // The scale lives on an outer group so his breathing, his sway and the
    // turn to face a branch all stay in his own units — and so the rise the
    // branches follow is the rise you can see.
    <group scale={scale}>
      <group ref={group}>
        {/* head */}
        <mesh ref={head} position={[0, HEAD_Y, 0]} castShadow>
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

        {/* legs, half his height, and feet on the ground. Grouped so the
            weight can shift from one to the other on a beat. */}
        <group ref={hips}>
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
    </group>
  )
}
