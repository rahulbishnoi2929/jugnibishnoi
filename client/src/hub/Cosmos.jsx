import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cosmicScale, cosmicStage, fitRadius, stagePlacement } from './layout.js'
import { galaxy, solarSystem, starfield, universe } from './cosmos.js'

// What you find when you keep zooming out.
//
// Three stages, all mounted all the time, shown by scale and opacity rather
// than by mounting and unmounting — a remount in the middle of a pinch is a
// stutter you can feel. They cost nothing while invisible: a handful of
// draw calls asleep behind a visible flag.
//
// Every stage is scaled by fitRadius / its own radius, so its declared
// radius lands on a known fraction of the frame no matter what shape the
// viewport is. That is the one rule that makes the ladder work, and the
// reason the first version was unusable: it scaled all three by the same
// factor while their local radii were 5.3, 22 and 70, so each arrived at a
// wildly different size and none of them ever fitted the screen.

// How fast each turns. Not the system spinning — the sky turning around
// you, which is the one rotation you can see from where he is standing.
const SPIN = { solar: 0.02, galaxy: 0.008, universe: 0.003 }

const SHOWN = 0.004 // below this a stage is skipped entirely

// Scratch, so the frame loop allocates nothing.
const _place = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: 1,
}

export default function Cosmos({ zoom }) {
  const data = useMemo(
    () => [solarSystem(), galaxy(), universe()],
    []
  )
  const sky = useMemo(() => starfield(), [])
  const groups = useRef([])
  const skyRef = useRef()

  useFrame((state, dt) => {
    const t = cosmicScale(zoom.current)
    const cam = state.camera

    // The camera aims at the origin once you are past the hub, so its own
    // distance is the distance to everything that matters.
    const dist = cam.position.length()
    const fit = fitRadius(cam, dist)

    // World size of one screen pixel, for a point at the camera's distance.
    //
    // This is three's own rule and not the ordinary projection: its point
    // shader does gl_PointSize = size * (height/2) / -z, with no field of
    // view in it at all. Converting with the usual tan(fov/2) — which is
    // right for geometry and wrong for points — made every cloud out here
    // 2.7 times smaller than asked for.
    const pointUnit = dist / (state.size.height / 2)

    data.forEach((stage, i) => {
      const g = groups.current[i]
      if (!g) return
      const { size, opacity } = cosmicStage(t, i + 1)

      g.visible = opacity > SHOWN
      if (!g.visible) return

      // One transform, from the one place that defines it. The anchor
      // offset inside it slides out as the stage settles, so the
      // composition hands over from Earth-centred to sun-centred while you
      // watch rather than hanging Neptune's orbit over the frame edge.
      const spin = (g.userData.spin = (g.userData.spin ?? 0) + dt * SPIN[stage.id])
      stagePlacement(stage, size, fit, spin, _place)
      g.position.copy(_place.position)
      g.quaternion.copy(_place.quaternion)
      g.scale.setScalar(_place.scale)

      g.traverse((o) => {
        if (!o.material) return
        o.material.opacity = (o.userData.base ?? 1) * opacity
        // Point size in three is a world-space quantity and is NOT taken
        // from the object's matrix, so a group scale does not touch it —
        // every cloud out here would otherwise render at a hundredth of a
        // pixel. `point` is the size wanted in pixels once the stage is the
        // subject, converted here, and still multiplied by the ladder size
        // so the stars recede along with the structure they belong to
        // instead of staying fat while it shrinks to a dot.
        if (o.userData.point) o.material.size = o.userData.point * pointUnit * size
      })
    })

    // The sky is behind everything and belongs to no stage, so it never
    // scales. It fades in as you leave his planet and then simply stays.
    if (skyRef.current) {
      const on = THREE.MathUtils.clamp((t - 0.05) / 0.45, 0, 1)
      skyRef.current.visible = on > 0.01
      skyRef.current.material.opacity = on * 0.9
    }
  })

  const hold = (i) => (el) => {
    if (el) groups.current[i] = el
  }

  return (
    <group>
      <points ref={skyRef} geometry={useGeo(sky.pos, sky.col)} visible={false}>
        {/* The sky is never scaled by a stage, and it sits at a fixed
            radius, so its size can be a constant: 1.2 world units at a
            shell radius of 320 renders at about a pixel and a half, which
            is under the galaxy's stars so the galaxy still reads brighter
            than the backdrop behind it. */}
        <pointsMaterial
          size={1.2}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>

      <group ref={hold(0)} visible={false}>
        <Solar data={data[0]} />
      </group>
      <group ref={hold(1)} visible={false}>
        <Galaxy data={data[1]} />
      </group>
      <group ref={hold(2)} visible={false}>
        <Universe data={data[2]} />
      </group>
    </group>
  )
}

// ---------- stage 1: the solar system ----------

function Solar({ data }) {
  // Every orbit in one geometry: eight ellipses, each a real one with the
  // sun at a focus and the plane tipped by the planet's own inclination.
  const orbits = useGeo(
    useMemo(() => {
      const out = []
      for (const p of data.planets) {
        for (let i = 0; i < p.path.length - 1; i++) {
          out.push(...p.path[i], ...p.path[i + 1])
        }
      }
      return new Float32Array(out)
    }, [data])
  )

  const asteroids = useGeo(data.asteroids)
  const kuiper = useGeo(data.kuiper)
  const rings = useGeo(data.rings)

  return (
    <group>
      <lineSegments geometry={orbits} userData={{ base: 0.34 }}>
        <lineBasicMaterial color="#7d93ab" transparent opacity={0.34} />
      </lineSegments>

      {/* The main belt, 2.1 to 3.3 AU, which lands in the gap between Mars
          and Jupiter on its own. */}
      <points geometry={asteroids} userData={{ base: 0.5, point: 1.3 }}>
        <pointsMaterial
          size={0.01}
          sizeAttenuation
          color="#9a8f7e"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </points>

      {/* And the Kuiper belt beyond Neptune, deliberately running off the
          edge of the frame. */}
      <points geometry={kuiper} userData={{ base: 0.32, point: 1.4 }}>
        <pointsMaterial
          size={0.01}
          sizeAttenuation
          color="#7f8ba0"
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </points>

      {/* The sun: a hot core inside a wider, fainter one. Two spheres is a
          cheaper glow than a shader and reads the same at this size. */}
      <mesh userData={{ base: 1 }}>
        <sphereGeometry args={[data.sun, 28, 28]} />
        <meshBasicMaterial color="#ffe9b0" transparent opacity={1} />
      </mesh>
      <mesh userData={{ base: 0.18 }}>
        <sphereGeometry args={[data.sun * 1.7, 24, 24]} />
        <meshBasicMaterial color="#e2703a" transparent opacity={0.18} />
      </mesh>

      {data.planets.map((p) => (
        <mesh key={p.name} position={p.pos} userData={{ base: 1 }}>
          <sphereGeometry args={[p.size, 20, 20]} />
          <meshBasicMaterial color={p.color} transparent opacity={1} />
        </mesh>
      ))}

      {/* Saturn's rings, 1.11 to 2.27 Saturn radii, tipped 26.7 degrees. */}
      <lineSegments geometry={rings} userData={{ base: 0.55 }}>
        <lineBasicMaterial color="#d8c68f" transparent opacity={0.55} />
      </lineSegments>

      <Marker at={data.anchor} r={data.planets[2].size * 3.5} />
    </group>
  )
}

// ---------- stage 2: the galaxy ----------

function Galaxy({ data }) {
  return (
    <group>
      <points geometry={useGeo(data.pos, data.col)} userData={{ base: 0.9, point: 1.8 }}>
        <pointsMaterial
          size={0.01}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <Marker at={data.sun} r={0.06} />
    </group>
  )
}

// ---------- stage 3: the observable universe ----------

function Universe({ data }) {
  return (
    <group>
      {/* The web goes under the galaxies and stays nearly invisible: it is
          there to make the clustering legible, not to be looked at. */}
      <lineSegments geometry={useGeo(data.web)} userData={{ base: 0.06 }}>
        <lineBasicMaterial color="#5b8dbe" transparent opacity={0.06} />
      </lineSegments>
      <points geometry={useGeo(data.pos, data.col)} userData={{ base: 0.9, point: 2.0 }}>
        <pointsMaterial
          size={0.01}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>
      <Marker at={data.home} r={0.09} />
    </group>
  )
}

// A ring around the thing you came from, at every scale. The same gesture
// three times is what makes the ladder read as one journey rather than
// three pictures.
function Marker({ at, r }) {
  const ring = useGeo(
    useMemo(() => {
      const pts = []
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2
        const b = ((i + 1) / 72) * Math.PI * 2
        pts.push(Math.cos(a) * r, Math.sin(a) * r, 0)
        pts.push(Math.cos(b) * r, Math.sin(b) * r, 0)
      }
      return new Float32Array(pts)
    }, [r])
  )

  return (
    <lineSegments position={at} geometry={ring} userData={{ base: 0.6 }}>
      <lineBasicMaterial color="#d4a72c" transparent opacity={0.6} />
    </lineSegments>
  )
}

// One buffer geometry from flat arrays, kept across renders.
function useGeo(pos, col) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [pos, col])
}
