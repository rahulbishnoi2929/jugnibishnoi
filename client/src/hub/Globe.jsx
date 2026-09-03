import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

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

// India, coarse. Roughly two dozen points clockwise from the Rann of
// Kutch. Recognisable, not survey-grade.
const INDIA = [
  [68.2, 23.9], [70.0, 22.6], [72.6, 21.7], [72.8, 19.1], [73.5, 15.9],
  [74.9, 13.0], [76.0, 10.3], [77.5, 8.1], [79.9, 10.3], [80.3, 13.1],
  [82.3, 16.9], [84.8, 19.1], [86.9, 21.5], [88.1, 21.8], [89.1, 22.0],
  [89.7, 25.3], [88.2, 26.4], [92.0, 26.0], [94.5, 27.3], [96.2, 27.6],
  [92.0, 27.9], [88.7, 28.1], [85.0, 28.2], [81.0, 30.3], [79.0, 31.0],
  [77.0, 32.5], [75.5, 34.5], [74.0, 34.4], [73.9, 32.5], [71.5, 29.5],
  [70.5, 28.0], [69.5, 26.5],
]

export default function Globe({ radius = 4.6 }) {
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

  const india = useMemo(
    () => INDIA.map(([lon, lat]) => onSphere(lon, lat, radius * 1.004)),
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
            <sphereGeometry args={[radius, 64, 48]} />
            <meshStandardMaterial color="#080c0a" roughness={1} metalness={0} />
          </mesh>

          <lineSegments geometry={graticule}>
            <lineBasicMaterial color="#4a5e56" transparent opacity={0.38} />
          </lineSegments>

          <Line
            points={india}
            color="#d4a72c"
            lineWidth={1.8}
            transparent
            opacity={0.85}
            closed
          />
        </group>
      </group>
    </group>
  )
}
