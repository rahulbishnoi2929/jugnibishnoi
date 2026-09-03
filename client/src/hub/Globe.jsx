import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
// India's outline, from real boundary data rather than points typed by hand.
// scripts/gen-india.js documents whose boundary this is — it is the de-facto
// line, not India's official claim.
import indiaData from './india.json'

// The ground is a small planet, and he is standing on Punjab.
//
// Drawn as line work rather than a textured earth: it matches the SVG
// scenes, costs no image asset, and a wireframe globe reads as a globe at
// any size. The scale is honestly nonsense — India is a few metres across
// — but that is the point of a little planet.

// Fazilka, near enough. This point is rotated to the top of the sphere so
// that the figure at the origin is standing on it.
const HOME_LAT = 30.4
const HOME_LON = 74.0

const rad = (d) => (d * Math.PI) / 180

// lon 0 faces +z, so the rotations below are simple.
function onSphere(lon, lat, r) {
  const la = rad(lat)
  const lo = rad(lon)
  return new THREE.Vector3(
    r * Math.cos(la) * Math.sin(lo),
    r * Math.sin(la),
    r * Math.cos(la) * Math.cos(lo)
  )
}

export default function Globe({ radius = 1.35 }) {
  // Real coastlines, from world-atlas land-110m (Natural Earth, public
  // domain), baked into an equirectangular SVG by scripts/gen-earth.
  //
  // The offset is not a fudge: three's SphereGeometry puts u=0.25 at
  // longitude 0 (its u=0 lands on -X), while the image puts longitude 0 at
  // u=0.5. The quarter turn between those is exactly 0.25.
  const earth = useLoader(THREE.TextureLoader, '/textures/earth.svg')
  useMemo(() => {
    earth.wrapS = THREE.RepeatWrapping
    earth.offset.x = 0.25
    earth.colorSpace = THREE.SRGBColorSpace
    earth.anisotropy = 4
  }, [earth])

  // Latitude and longitude lines as one geometry, so the whole graticule
  // is a single draw call instead of two dozen.
  const graticule = useMemo(() => {
    const pts = []
    const push = (a, b) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z)

    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon < 360; lon += 6) {
        push(onSphere(lon, lat, radius), onSphere(lon + 6, lat, radius))
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      for (let lat = -84; lat < 84; lat += 6) {
        push(onSphere(lon, lat, radius), onSphere(lon, lat + 6, radius))
      }
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [radius])

  const indiaRings = useMemo(
    () =>
      indiaData.rings.map((r0) =>
        r0.map(([lon, lat]) => onSphere(lon, lat, radius * 1.004))
      ),
    [radius]
  )

  return (
    // Sink it so the surface is at y=0, where he stands.
    <group position={[0, -radius, 0]}>
      {/* Bring his corner of Punjab to the top: longitude first, then
          latitude, which is why these are nested rather than one Euler. */}
      <group rotation={[-rad(90 - HOME_LAT), 0, 0]}>
        <group rotation={[0, -rad(HOME_LON), 0]}>
          <mesh>
            <sphereGeometry args={[radius, 96, 64]} />
            {/* The planet sits below the lights, so most of it would be
                in shadow. The map doubles as an emissive map at low
                intensity: the continents stay readable everywhere while
                the lit side still reads as lit. */}
            <meshStandardMaterial
              map={earth}
              emissiveMap={earth}
              emissive="#ffffff"
              emissiveIntensity={0.42}
              roughness={1}
              metalness={0}
            />
          </mesh>

          <lineSegments geometry={graticule}>
            <lineBasicMaterial color="#4a5e56" transparent opacity={0.38} />
          </lineSegments>

          {indiaRings.map((points, i) => (
            <Line
              key={i}
              points={points}
              color="#d4a72c"
              lineWidth={1.8}
              transparent
              opacity={0.85}
              closed
            />
          ))}
        </group>
      </group>
    </group>
  )
}
