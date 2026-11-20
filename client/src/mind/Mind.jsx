import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { tuneStars } from '../hub/shaders.js'
import { useDisposable } from '../hub/dispose.js'
import { projects as featured, projectId } from './projects.js'
import { CENTER, head, skull, neurons, loops, loopAt } from './mind.js'
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

// Skin brighter than bone, so the face is what you see and the skull is
// what you see through it.
const SKIN = new THREE.Color('#cdeedf')
const BONE = new THREE.Color('#bfe9d6').multiplyScalar(0.5)
const NERVE = new THREE.Color('#3DDC97')
const WORK = '#ffb547'
const APPEAR = 0.6 // seconds to grow in
const SPIN = reduced ? 0 : 0.06 // radians a second

// The skin and the bone. A point shader like the stars' (same uniforms, so tuneStars
// sizes it), with one thing added: each point is lit by how edge-on its
// bit of surface is to you. Facing you, it is barely there; turning away,
// it glows. That is the whole of what makes it read as glass rather than
// a cloud — the outline, the sockets, the nose and the jaw light up from
// whichever side you look, and the dome you are looking through does not.
function glassMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 400 },
      uSize: { value: 0.05 },
      uOpacity: { value: 0 },
      uColor: { value: color.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aNormal;
      uniform float uScale;
      uniform float uSize;
      varying float vGlow;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * aNormal);
        float rim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
        vGlow = 0.08 + pow(rim, 2.5) * 1.3;
        gl_PointSize = min(aSize * uSize * (uScale / -mv.z), 56.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vGlow;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d) * 4.0;
        float a = exp(-r2 * 3.4) * (1.0 - smoothstep(0.7, 1.0, r2));
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor * vGlow, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

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

  // The skin and the bone arrive from a worker — seconds of arithmetic
  // that would otherwise freeze the page as Build opens. Until then the
  // neurons and the projects are already there, and each layer fades in
  // round them as it lands. Without a worker, they are made here.
  const [layers, setLayers] = useState({})
  const shown = useRef({ skin: 0, bone: 0 })
  useEffect(() => {
    const counts = narrow ? { skin: 5000, bone: 2500 } : { skin: 10000, bone: 5000 }
    const made = []
    let gone = false
    const take = ({ kind, pos, normal, size }) => {
      if (gone) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      g.setAttribute('aNormal', new THREE.BufferAttribute(normal, 3))
      g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
      made.push(g)
      shown.current[kind] = 0
      setLayers((l) => ({ ...l, [kind]: g }))
    }
    let worker = null
    try {
      worker = new Worker(new URL('./skull.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = (e) => take(e.data)
      worker.postMessage(counts)
    } catch {
      take({ kind: 'skin', ...head({ count: counts.skin }) })
      take({ kind: 'bone', ...skull({ count: counts.bone }) })
    }
    return () => {
      gone = true
      worker?.terminate()
      made.forEach((g) => g.dispose())
    }
  }, [narrow])
  const skinMat = useDisposable(() => glassMaterial(SKIN), [])
  const boneMat = useDisposable(() => glassMaterial(BONE), [])

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
    for (const [kind, mat] of [
      ['skin', skinMat],
      ['bone', boneMat],
    ]) {
      if (layers[kind])
        shown.current[kind] = Math.min(1, shown.current[kind] + dt / (reduced ? 0.001 : 0.8))
      tuneStars(mat, {
        px: narrow ? 1.6 : 1.4,
        dist,
        height: state.size.height,
        dpr: state.viewport.dpr,
        size: scale,
        opacity: shown.current[kind],
      })
    }
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
      {/* Lifted so the middle of the head and neck, not the middle of the
          skull, is what sits on `at` and what it turns about. */}
      <group position={[-CENTER[0], -CENTER[1], -CENTER[2]]}>
        {layers.skin && <points geometry={layers.skin} material={skinMat} />}
        {layers.bone && <points geometry={layers.bone} material={boneMat} />}
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
              {/* On the point, not above it: a label hung over its light
                stuck out of the top of the head. */}
              <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
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
                </button>
              </Html>
            </group>
          )
        })}
      </group>
    </group>
  )
}
