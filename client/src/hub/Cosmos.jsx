import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAGES, cosmicScale, cosmicStage } from './layout.js'
import { EARTH, galaxy, solarSystem, universe } from './cosmos.js'

// What you find when you keep zooming out.
//
// The three stages are all mounted all the time and shown by scale and
// opacity rather than by mounting and unmounting, because a remount in the
// middle of a pinch is a stutter you can feel. They cost nothing when they
// are invisible: three draw calls asleep behind a visible flag.
//
// Every stage is offset so that the thing you came from sits at the origin
// — Earth for the solar system, the sun for the galaxy, our own cluster for
// the universe. That is what makes this nesting rather than three separate
// pictures: his planet shrinks into the exact spot it belongs in, instead
// of into the middle of the sun.
//
// Each stage also turns, slowly, about that same point: not the system
// spinning but the sky turning around you, which is the one rotation you
// can actually see from where he is standing. A still starfield reads as a
// photograph rather than a place.
const SPIN = { solar: 0.018, galaxy: 0.008, universe: 0.003 }

// A stage is invisible below this, and skipped entirely.
const SHOWN = 0.004

export default function Cosmos({ zoom }) {
  const groups = useRef({})

  useFrame((_, dt) => {
    const t = cosmicScale(zoom.current)

    STAGES.forEach((name, i) => {
      const g = groups.current[name]
      if (!g) return
      const { scale, opacity } = cosmicStage(t, i + 1)

      g.visible = opacity > SHOWN
      if (!g.visible) return

      // Clamped because the outer stages sit at absurd scales long before
      // you can see them, and a bounding sphere of 1e5 is worth avoiding
      // even when nothing is drawn from it.
      g.scale.setScalar(THREE.MathUtils.clamp(scale, 1e-4, 90))
      g.rotation.y += dt * SPIN[name]

      g.traverse((o) => {
        if (o.material) o.material.opacity = (o.userData.base ?? 1) * opacity
      })
    })
  })

  const hold = (name) => (el) => {
    if (el) groups.current[name] = el
  }

  return (
    <group>
      <group ref={hold('solar')} visible={false}>
        <Solar />
      </group>
      <group ref={hold('galaxy')} visible={false}>
        <Galaxy />
      </group>
      <group ref={hold('universe')} visible={false}>
        <Universe />
      </group>
    </group>
  )
}

// Tilts a stage so it reads as a volume rather than a diagram, and slides
// it so its anchor lands on the origin.
function Placed({ tilt, anchor, children }) {
  return (
    <group rotation={tilt}>
      <group position={[-anchor[0], -anchor[1], -anchor[2]]}>{children}</group>
    </group>
  )
}

// ---------- stage 1 ----------

function Solar() {
  const { orbits, planets, anchor } = useMemo(solarSystem, [])
  const rings = useMemo(() => geo(orbits), [orbits])

  return (
    <Placed tilt={[0.3, 0, 0.08]} anchor={anchor}>
      <lineSegments geometry={rings} userData={{ base: 0.32 }}>
        <lineBasicMaterial color="#8ea2b8" transparent opacity={0.32} />
      </lineSegments>

      {/* The sun: a small hot core inside a wider, fainter one. Two spheres
          is a cheaper glow than a shader and reads the same at this size. */}
      <mesh userData={{ base: 1 }}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={1} />
      </mesh>
      <mesh userData={{ base: 0.22 }}>
        <sphereGeometry args={[0.34, 24, 24]} />
        <meshBasicMaterial color="#e2703a" transparent opacity={0.22} />
      </mesh>

      {planets.map((p) => (
        <mesh key={p.name} position={p.pos} userData={{ base: 1 }}>
          <sphereGeometry args={[p.size, 18, 18]} />
          <meshBasicMaterial color={p.color} transparent opacity={1} />
        </mesh>
      ))}

      {/* You are here — and here is the origin, because the stage was slid
          to put it there. */}
      <Marker at={planets[EARTH].pos} r={0.3} />
    </Placed>
  )
}

// ---------- stage 2 ----------

function Galaxy() {
  const g = useMemo(() => galaxy(), [])
  const stars = useMemo(() => geo(g.pos, g.col), [g])

  return (
    <Placed tilt={[0.42, 0, 0.1]} anchor={g.anchor}>
      <points geometry={stars} userData={{ base: 0.85 }}>
        <pointsMaterial
          size={0.13}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <Marker at={g.sun} r={1.4} />
    </Placed>
  )
}

// ---------- stage 3 ----------

function Universe() {
  const u = useMemo(() => universe(), [])
  const points = useMemo(() => geo(u.pos, u.col), [u])
  const web = useMemo(() => geo(u.web), [u])

  return (
    <Placed tilt={[0.2, 0, 0]} anchor={u.anchor}>
      {/* The web goes under the galaxies and stays nearly invisible: it is
          there to make the clustering legible, not to be looked at. */}
      <lineSegments geometry={web} userData={{ base: 0.055 }}>
        <lineBasicMaterial color="#5b8dbe" transparent opacity={0.055} />
      </lineSegments>
      <points geometry={points} userData={{ base: 0.9 }}>
        <pointsMaterial
          size={0.5}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
      <Marker at={u.home} r={5} />
    </Placed>
  )
}

// A ring around the thing you came from, at every scale. The same gesture
// three times is what makes the ladder read as one journey.
function Marker({ at, r }) {
  const ring = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2
      pts.push(Math.cos(a) * r, Math.sin(a) * r, 0)
    }
    return geo(new Float32Array(pts))
  }, [r])

  return (
    <line position={at} geometry={ring} userData={{ base: 0.5 }}>
      <lineBasicMaterial color="#d4a72c" transparent opacity={0.5} />
    </line>
  )
}

// One buffer geometry from flat arrays.
function geo(pos, col) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
