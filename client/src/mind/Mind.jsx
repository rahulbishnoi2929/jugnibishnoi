import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { starMaterial, tuneStars } from '../hub/shaders.js'
import { useDisposable } from '../hub/dispose.js'
import { projects as featured, projectId } from './projects.js'
import { skull, neurons, loops, loopAt } from './mind.js'
import './mind.css'

// Build, opened: the inside of his head.
//
// The skull is points on a distance field and nothing else, which is why
// you can see through it. Neurons are line segments with a pulse running
// down each one on a clock. The projects are the bright things moving
// through it, the only part of the head you can tap.
//
// Everything is generated once per mount from mind.js and handed to the
// GPU; per frame there is a clock, a turn and a handful of positions.

const reduced =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const BONE = new THREE.Color('#bfe9d6').multiplyScalar(0.35)
const NERVE = new THREE.Color('#3DDC97')
const WORK = '#ffb547'
const APPEAR = 0.6 // seconds to grow in
const SPIN = reduced ? 0 : 0.06 // radians a second

// The pulse: a bright band travelling root to tip along each branch, at
// a phase of its own, over a dim line that is always there.
function nerveMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: NERVE },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      attribute float aPhase;
      varying float vAlong;
      varying float vPhase;
      void main() {
        vAlong = aAlong;
        vPhase = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlong;
      varying float vPhase;
      void main() {
        float x = fract(uTime * 0.35 + vPhase);
        float pulse = smoothstep(0.06, 0.0, abs(x - vAlong));
        gl_FragColor = vec4(uColor * (0.25 + pulse * 1.6), (0.12 + pulse) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

// `turn` is a ref the hub adds sideways drags to while you are in here —
// its own drag value is pinned by the chapter's framing, so it cannot be
// read for this.
export default function Mind({ narrow, at, scale, turn, picked, onPick }) {
  const group = useRef()
  const born = useRef(0)
  const start = useRef(turn?.current ?? 0)
  const spun = useRef(0)

  const bone = useDisposable(() => {
    const s = skull({ count: narrow ? 2500 : 6000 })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(s.size, 1))
    const col = new Float32Array(s.size.length * 3)
    for (let i = 0; i < s.size.length; i++) BONE.toArray(col, i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [narrow])
  const boneMat = useDisposable(() => starMaterial(), [])

  const nerves = useDisposable(() => {
    const n = neurons({ seeds: narrow ? 20 : 36 })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(n.pos, 3))
    g.setAttribute('aAlong', new THREE.BufferAttribute(n.along, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(n.phase, 1))
    return g
  }, [narrow])
  const nerveMat = useDisposable(nerveMaterial, [])

  // One loop per project, and how far round it each one has got. Held in
  // refs because they move every frame and nothing else needs to know.
  const paths = useRef(loops(featured.length))
  const where = useRef(featured.map(() => 0))
  const dots = useRef([])
  const [hot, setHot] = useState(null)

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.1)
    born.current = Math.min(1, born.current + dt / (reduced ? 0.001 : APPEAR))
    const grow = 1 - Math.pow(1 - born.current, 3)

    const g = group.current
    g.position.copy(at)
    g.scale.setScalar(scale * (0.6 + 0.4 * grow))
    spun.current += dt * SPIN
    g.rotation.y = spun.current + ((turn?.current ?? 0) - start.current)

    const dist = state.camera.position.distanceTo(at)
    tuneStars(boneMat, {
      px: narrow ? 1.6 : 1.4,
      dist,
      height: state.size.height,
      dpr: state.viewport.dpr,
      size: scale,
      opacity: grow,
    })
    nerveMat.uniforms.uTime.value += dt * (reduced ? 0.3 : 1)
    nerveMat.uniforms.uOpacity.value = grow

    featured.forEach((p, i) => {
      const id = projectId(p)
      // Slows under the pointer so it can be caught, and stops once open.
      const pace = picked === id ? 0 : hot === id ? 0.15 : 1
      where.current[i] += dt * paths.current[i].spin * pace * (reduced ? 0.3 : 1)
      const dot = dots.current[i]
      if (dot) dot.position.fromArray(loopAt(paths.current[i], where.current[i]))
    })
  })

  return (
    <group ref={group}>
      <points geometry={bone} material={boneMat} />
      <lineSegments geometry={nerves} material={nerveMat} />

      {featured.map((p, i) => {
        const id = projectId(p)
        return (
          <group key={id} ref={(el) => (dots.current[i] = el)}>
            <mesh>
              <sphereGeometry args={[0.028, 16, 12]} />
              <meshBasicMaterial color={WORK} />
            </mesh>
            {/* A halo, so it reads as a light and not a bead. */}
            <mesh>
              <sphereGeometry args={[0.065, 16, 12]} />
              <meshBasicMaterial
                color={WORK}
                transparent
                opacity={picked === id || hot === id ? 0.45 : 0.22}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            <Html
              position={[0, 0.11, 0]}
              center
              zIndexRange={[10, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <button
                type="button"
                className={'mind-project' + (picked === id ? ' is-open' : '')}
                aria-label={'Open ' + p.title}
                onClick={() => onPick(id)}
                onMouseEnter={() => setHot(id)}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(id)}
                onBlur={() => setHot(null)}
              >
                {p.title}
                <small>{p.blurb}</small>
              </button>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
