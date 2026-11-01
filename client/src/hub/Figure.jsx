import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HEAD_R, HEAD_Y } from './layout.js'
import { posture } from './pose.js'

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
const UPPER_ARM = (SHOULDER - HAND) / 2 // the elbow sits halfway down

export default function Figure({ bob, spin, turned, scale = 1, offering, vibe }) {
  const group = useRef()
  const upper = useRef()
  const hips = useRef()
  const chest = useRef()
  const armL = useRef()
  const armR = useRef()
  const elbowL = useRef()
  const elbowR = useRef()
  const wristL = useRef()
  const wristR = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  // Both eased rather than switched, because the point of a pose is the
  // moving into it. Refs, so neither costs a render.
  const open = useRef(0)
  const groove = useRef(0)

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const k = 1 - Math.pow(0.02, Math.min(dt, 0.1))
    open.current = THREE.MathUtils.lerp(open.current, offering ? 1 : 0, k)
    // Slower in than out: settling into a groove should feel like
    // settling, and stopping the music should stop him fairly promptly.
    const toward = vibe?.current ? 1 : 0
    groove.current = THREE.MathUtils.lerp(
      groove.current,
      toward,
      1 - Math.pow(toward ? 0.25 : 0.02, Math.min(dt, 0.1))
    )

    // Everything he is doing comes from one place. pose.js has no React in
    // its import graph, so a renderer and a test can ask it the same
    // question — which is the only reason any of this was tunable: a dance
    // measured only by reloading the page is a dance tuned by squinting.
    const p = posture(t, { open: open.current, groove: groove.current })

    group.current.position.y = p.bodyY
    group.current.rotation.z = p.bodyRoll
    // The branches grow out of his head, so they need to know where it is,
    // and in the same units — which means after his own scale. The dip
    // counts: his head goes down with his chest when his knees bend.
    if (bob) bob.current = (p.bodyY + p.dip) * scale

    // Inside a chapter he keeps facing you while the ring turns around
    // him. The turntable is what moves — it spins to bring the branch you
    // picked to the front, and he is inside it, so he was being carried
    // round with it. What cancels that is the turntable's own angle, so
    // that is what he reads. At the hub he turns with it, because there
    // the whole constellation is a thing you take hold of and spin.
    group.current.rotation.y = turned ? -(spin?.current ?? 0) : 0

    // Hips lead and shoulders answer. A body that turns in one piece is a
    // mannequin on a turntable.
    upper.current.position.y = p.dip
    upper.current.rotation.y = p.upperTurn
    upper.current.rotation.z = p.upperLean
    hips.current.position.x = p.hipsX
    hips.current.position.y = p.dip
    hips.current.rotation.y = p.hipsTurn

    chest.current.scale.y = p.chestY
    head.current.rotation.x = p.headNod
    head.current.rotation.y = p.headTurn
    head.current.rotation.z = p.headTilt

    armL.current.rotation.set(p.armL.x, p.armL.y, p.armL.z)
    armR.current.rotation.set(p.armR.x, p.armR.y, p.armR.z)
    elbowL.current.rotation.x = p.armL.elbow
    elbowR.current.rotation.x = p.armR.elbow
    wristL.current.rotation.x = p.armL.wrist
    wristR.current.rotation.x = p.armR.wrist

    // The legs absorb the dip rather than riding it, and shorten to meet
    // the pelvis that came down. That is a knee bend, and without it the
    // whole figure sank on every beat and put its feet through the floor —
    // measured, they travelled 0.19 vertically, and the ground does not
    // move.
    for (const [ref, side] of [[legL, p.legL], [legR, p.legR]]) {
      ref.current.rotation.x = side.x
      ref.current.position.y = side.lift - p.dip
      ref.current.scale.y = p.legSquash
    }
  })

  return (
    // The scale lives on an outer group so his breathing, his sway and the
    // turn to face a branch all stay in his own units — and so the rise the
    // branches follow is the rise you can see.
    <group scale={scale}>
      <group ref={group}>
        {/* Everything above the waist, so it can turn against the hips.
            The counter-rotation between the two is most of what reads as
            dancing rather than swaying. */}
        <group ref={upper}>
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

        {/* Arms, in two pieces with an elbow between them.
            One capsule on a shoulder can only swing like a pendulum,
            which is most of why the first dance read as a mannequin: a
            shoulder is one joint and a person dancing uses two. It is
            also what the offering gesture needs — the upper arm goes
            down and out, the forearm comes forward, palm up. */}
        {[
          ['armL', armL, elbowL, -1],
          ['armR', armR, elbowR, 1],
        ].map(([key, ref, bend, s]) => (
          <group key={key} ref={ref} position={[s * HALF_SHOULDER, SHOULDER - 0.02, 0]}>
            <mesh position={[0, -UPPER_ARM / 2, 0]} rotation={[0, 0, s * 0.06]}>
              <capsuleGeometry args={[0.05, UPPER_ARM - 0.08, 6, 16]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.85} />
            </mesh>
            <mesh position={[0, -UPPER_ARM, 0]}>
              <sphereGeometry args={[0.046, 14, 14]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.85} />
            </mesh>

            <group ref={bend} position={[0, -UPPER_ARM, 0]}>
              <mesh position={[0, -UPPER_ARM / 2, 0]}>
                <capsuleGeometry args={[0.045, UPPER_ARM - 0.08, 6, 16]} />
                <meshStandardMaterial color="#1b1d21" roughness={0.85} />
              </mesh>

              {/* A wrist, and a palm rather than a ball.
                  A sphere cannot show rotation, so the old hand was not a
                  hand — it was the place a hand would have gone. Flat, so
                  that turning it reads, which is the whole of what makes
                  an open palm look like an offer. */}
              <group ref={key === 'armL' ? wristL : wristR} position={[0, -UPPER_ARM, 0]}>
                <mesh position={[0, -0.045, 0]}>
                  <boxGeometry args={[0.085, 0.095, 0.032]} />
                  <meshStandardMaterial color="#1b1d21" roughness={0.85} />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        </group>

        {/* legs, half his height, and feet on the ground. Grouped so the
            weight can shift from one to the other on a beat, and each one
            held separately so it can take its own step and its own bend. */}
        <group ref={hips}>
        {[
          ['L', legL, -1],
          ['R', legR, 1],
        ].map(([key, ref, s]) => (
          <group key={key} ref={ref} position={[s * 0.082, 0, 0]}>
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
