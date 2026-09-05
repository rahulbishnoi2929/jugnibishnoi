import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cosmicScale, cosmicStage, fitRadius, stagePlacement } from './layout.js'
import { galaxy, solarSystem, starfield, universe } from './cosmos.js'
import {
  orbitMaterial,
  planetMaterial,
  ringMaterial,
  starMaterial,
  tuneStars,
} from './shaders.js'

// What you find when you keep zooming out.
//
// Three stages, all mounted all the time, shown by scale and opacity rather
// than by mounting and unmounting — a remount in the middle of a pinch is a
// stutter you can feel. They cost nothing while invisible.
//
// Every stage is scaled by fitRadius / its own radius, so its declared
// radius lands on a known fraction of the frame whatever shape the viewport
// is. That is the one rule that makes the ladder work, and the reason the
// first version was unusable: it scaled all three by the same factor while
// their local radii were 5.3, 22 and 70, so each arrived at a wildly
// different size and none ever fitted the screen.
//
// Nothing out here uses a stock material. Points go through starMaterial
// for per-point size and a soft round falloff, planets through
// planetMaterial so each is lit by its own sun. shaders.js says why.

// How fast each turns. Not the system spinning — the sky turning around
// you, which is the one rotation you can see from where he is standing.
const SPIN = { solar: 0.02, galaxy: 0.008, universe: 0.003 }

const SHOWN = 0.004 // below this a stage is skipped entirely

const smooth = (x, a, b) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// Scratch, so the frame loop allocates nothing.
const _place = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: 1,
}

export default function Cosmos({ zoom }) {
  // Built after the first paint, not during it. Sampling the galaxy's forty
  // thousand points takes about a tenth of a second on a desktop and three
  // times that on a phone, and none of it is on screen at the hub — doing
  // it inline froze the home page on load for something invisible.
  const [built, setBuilt] = useState(null)
  useEffect(() => {
    let live = true
    const id = setTimeout(() => {
      if (live) setBuilt({ stages: [solarSystem(), galaxy(), universe()], sky: starfield() })
    }, 0)
    return () => {
      live = false
      clearTimeout(id)
    }
  }, [])

  const data = built?.stages
  const sky = built?.sky
  const groups = useRef([])
  const skyRef = useRef()
  const bandRef = useRef()

  useFrame((state, dt) => {
    if (!data) return
    const t = cosmicScale(zoom.current)
    const cam = state.camera
    // The camera aims at the origin once you are past the hub, so its own
    // distance is the distance to everything that matters.
    const dist = cam.position.length()
    const fit = fitRadius(cam, dist)
    const height = state.size.height
    const dpr = state.gl.getPixelRatio()

    // Each stage is placed so the thing you came from lands on the world
    // origin, which is where his planet is and where every other stage's
    // anchor is too. Four scales stacked on one point.
    data.forEach((stage, i) => {
      const g = groups.current[i]
      if (!g) return
      const { size, opacity } = cosmicStage(t, i + 1)

      g.visible = opacity > SHOWN
      if (!g.visible) return

      const spin = (stage.spin = (stage.spin ?? 0) + dt * SPIN[stage.id])
      stagePlacement(stage, size, fit, spin, _place)
      g.position.copy(_place.position)
      g.quaternion.copy(_place.quaternion)
      g.scale.setScalar(_place.scale)

      g.traverse((o) => {
        const m = o.material
        if (!m) return
        const base = o.userData.base ?? 1
        if (o.userData.px) {
          // A star cloud. Its size is asked for in pixels and converted
          // here, then multiplied by the ladder size so the stars recede
          // with the structure they belong to rather than staying fat while
          // it shrinks to a dot.
          tuneStars(m, {
            px: o.userData.px,
            dist,
            height,
            dpr,
            size,
            opacity: base * opacity,
          })
        } else if (m.uniforms && m.uniforms.uOpacity) {
          m.uniforms.uOpacity.value = base * opacity
        } else {
          m.opacity = base * opacity
        }
      })
    })

    // The sky is behind everything and belongs to no stage, so it never
    // scales. It fades in as you leave his planet and then simply stays.
    if (skyRef.current) {
      // Smoothstep, not a straight ramp: a linear fade has a visible corner
      // at each end, and this one runs right across the moment his planet
      // stops being the subject.
      const x = THREE.MathUtils.clamp((t - 0.05) / 0.45, 0, 1)
      const on = x * x * (3 - 2 * x)
      // Past the galaxy you are outside it, so the local sky should thin
      // out rather than stay as dense as it looks from Punjab.
      const local = 1 - 0.72 * smooth(t, 1.4, 2.2)
      skyRef.current.visible = on > 0.01
      tuneStars(skyRef.current.material, {
        px: 1.15,
        dist: sky.radius,
        height,
        dpr,
        size: 1,
        opacity: on * 0.95 * local,
      })

      // And the Milky Way's own band is something you can only see from
      // inside the Milky Way, so it goes as you leave.
      if (bandRef.current) {
        const inside = on * (1 - smooth(t, 1.0, 1.9))
        bandRef.current.visible = inside > 0.01
        tuneStars(bandRef.current.material, {
          px: 1.0,
          dist: sky.radius,
          height,
          dpr,
          size: 1,
          opacity: inside * 0.05,
        })
      }
    }
  })

  const hold = (i) => (el) => {
    if (el) groups.current[i] = el
  }

  if (!data) return null

  return (
    <group>
      <Stars ref={skyRef} layer={sky} px={1.15} base={0.95} visible={false} />
      <Stars
        ref={bandRef}
        layer={sky.band}
        px={1.0}
        base={0.05}
        falloff={1.5}
        visible={false}
      />

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
  // Every orbit in one geometry: eight real ellipses, the sun at a focus
  // and each plane tipped by its own inclination.
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

  const orbitLines = useMemo(() => orbitMaterial('#8ea6c4', data.radius), [data])

  // One material per planet, built once. Each carries its own centre so the
  // shader knows which way its sun is, and its own spin axis so the banding
  // runs the right way — across Jupiter's equator, and pole to pole on
  // Uranus, which is tipped ninety-eight degrees.
  const lit = useMemo(
    () => data.planets.map((p) => planetMaterial(p.color, p.pos, p.axis, p.bands)),
    [data]
  )
  const saturn = data.planets[5]
  const rings = useMemo(
    () => ringMaterial('#d8c68f', saturn.pos, saturn.size * 1.11, saturn.size * 2.27),
    [saturn]
  )
  // The rings lie in Saturn's equatorial plane, so their normal is its own
  // axis. Derived rather than typed, which is how the 26.7 degrees ends up
  // living in exactly one place.
  const ringTurn = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(saturn.axis[0], saturn.axis[1], saturn.axis[2]).normalize()
      ),
    [saturn]
  )

  return (
    <group>
      <lineSegments geometry={orbits} material={orbitLines} userData={{ base: 0.42 }} />

      {/* The main belt at its real 2.1 to 3.3 AU, and the Kuiper belt
          beyond Neptune, running deliberately off the frame. */}
      <Stars layer={data.asteroids} px={1.25} base={0.55} />
      <Stars layer={data.kuiper} px={1.3} base={0.34} />

      {/* The sun: a small hot disc inside a wide soft glow made of one very
          large additive point — what a star looks like through a lens, and
          what two flat spheres never did. */}
      <mesh userData={{ base: 1 }}>
        <sphereGeometry args={[data.sun * 0.8, 28, 28]} />
        <meshBasicMaterial color="#fff3cf" transparent opacity={1} />
      </mesh>
      <Stars layer={data.glow} px={7} base={0.55} falloff={2.1} />

      {data.planets.map((p, i) => (
        <mesh key={p.name} position={p.pos} material={lit[i]} userData={{ base: 1 }}>
          <sphereGeometry args={[p.size, 24, 24]} />
        </mesh>
      ))}

      {/* Saturn's rings: 1.11 to 2.27 Saturn radii, tipped 26.7 degrees,
          banded in the shader so the Cassini division is in there. */}
      <mesh
        position={saturn.pos}
        quaternion={ringTurn}
        material={rings}
        userData={{ base: 0.9 }}
      >
        <ringGeometry args={[saturn.size * 1.11, saturn.size * 2.27, 96]} />
      </mesh>

      <Marker at={data.anchor} r={data.planets[2].size * 3.5} />
    </group>
  )
}

// ---------- stage 2: the galaxy ----------

// Four layers, because a photograph of a galaxy is mostly unresolved light
// with a handful of resolved stars in front of it. Drawn back to front: the
// haze, the old bulge, the disc, then the star-forming knots on top.
function Galaxy({ data }) {
  return (
    <group>
      <Stars layer={data.layers.haze} px={1.0} base={0.05} falloff={1.6} />
      <Stars layer={data.layers.nucleus} px={26} base={0.42} falloff={1.9} />
      <Stars layer={data.layers.bulge} px={1.5} base={0.5} />
      <Stars layer={data.layers.disc} px={1.5} base={0.8} />
      <Stars layer={data.layers.hii} px={1.5} base={0.45} />
      <Marker at={data.sun} r={0.055} />
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
      <Stars layer={data.layers.gal} px={1.9} base={0.9} elliptical />
      <Marker at={data.home} r={0.085} />
    </group>
  )
}

// ---------- pieces ----------

// A cloud of soft round points, each with its own size.
const Stars = forwardRef(function Stars(
  { layer, px, base, falloff, elliptical = false, visible = true },
  ref
) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(layer.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(layer.col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(layer.siz, 1))
    if (elliptical) {
      g.setAttribute('aAspect', new THREE.BufferAttribute(layer.asp, 1))
      g.setAttribute('aAngle', new THREE.BufferAttribute(layer.ang, 1))
    }
    return g
  }, [layer, elliptical])
  const mat = useMemo(
    () => starMaterial({ falloff, elliptical }),
    [falloff, elliptical]
  )

  return (
    <points
      ref={ref}
      geometry={geo}
      material={mat}
      visible={visible}
      userData={{ base, px }}
    />
  )
})

// A ring around the thing you came from, at every scale. The same gesture
// three times is what makes the ladder read as one journey rather than
// three separate pictures.
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
    <lineSegments position={at} geometry={ring} userData={{ base: 0.65 }}>
      <lineBasicMaterial color="#d4a72c" transparent opacity={0.65} />
    </lineSegments>
  )
}

function useGeo(pos) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [pos])
}
