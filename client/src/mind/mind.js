// The inside of his head, as plain arrays of points.
//
// The same idiom as hub/cosmos.js: pure, seeded, no React and no scene
// objects, so it runs and is asserted under node. Nothing here is a model
// file. The skull is a handful of ellipsoids blended into one distance
// field, and the points are scattered over its surface — which is also
// why it comes out transparent: there is no bone, only where the bone
// would be, drawn in light.
//
// Units: the whole head fits in a sphere of radius 1 round the origin.
// y is up and the face looks down +z.

// Seeded, so it is the same head every time. mulberry32, as in cosmos.js.
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller, for scatter that falls off rather than stopping dead.
export function gauss(rand) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

// ============================================================
// the skull
// ============================================================

// An ellipsoid's distance, approximately. Exact only on the surface, which
// is the only place it is ever asked to be exact.
const ell = (p, c, r) => {
  const x = (p[0] - c[0]) / r[0]
  const y = (p[1] - c[1]) / r[1]
  const z = (p[2] - c[2]) / r[2]
  return (Math.hypot(x, y, z) - 1) * Math.min(r[0], r[1], r[2])
}

// A rounded rod from a to b — the jaw, the arches of the cheekbones.
const rod = (p, a, b, r) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const t = Math.max(
    0,
    Math.min(
      1,
      (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2),
    ),
  )
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - r
}

// Union with a fillet, so one bone grows out of the next rather than
// being stuck on to it.
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// Both sides of the face from one description of the left.
const both = (f) => (p) => Math.min(f(p), f([-p[0], p[1], p[2]]))

// What is carved out. Deep, not dents: in a skull drawn in light it is
// the walls of a hole, seen nearly edge on, that make the bright ring —
// a shallow scoop has no walls and reads as nothing, which is how the
// first version came out with eyes you could barely find and a nose that
// was one dot.
const orbit = both((p) => ell(p, [0.18, 0, 0.5], [0.13, 0.125, 0.22]))
// The nasal opening is a pear standing on its point: narrow between the
// eyes, widest just above the teeth.
const nose = (p) =>
  Math.min(ell(p, [0, -0.12, 0.52], [0.05, 0.1, 0.2]), ell(p, [0, -0.22, 0.52], [0.085, 0.07, 0.2]))
const holes = (p) => Math.min(orbit(p), nose(p))

// Upper and lower teeth, a row each along the arc of the jaw.
const TOOTH = 0.032
const ARC = 0.27
const teeth = (p) => {
  let d = Infinity
  for (let i = 0; i < 8; i++) {
    const a = -0.95 + (1.9 * i) / 7
    const x = ARC * Math.sin(a)
    const z = 0.2 + ARC * Math.cos(a)
    d = Math.min(
      d,
      ell(p, [x, -0.36, z], [TOOTH, TOOTH * 1.4, TOOTH]),
      ell(p, [x * 0.96, -0.44, z - 0.01], [TOOTH, TOOTH * 1.3, TOOTH]),
    )
  }
  return d
}

// The lower jaw: a horseshoe — a flattened ellipsoid with its inside
// scooped out and its back left open — with a chin on the front and a
// branch up each side to the hinge under the ear.
const jaw = (p) => {
  const shoe = Math.max(
    ell(p, [0, -0.5, 0.18], [0.3, 0.15, 0.33]),
    -ell(p, [0, -0.48, 0.08], [0.22, 0.2, 0.3]),
  )
  // A flat blade, not a rod: thin side to side, wide front to back.
  const ramus = both((q) => ell(q, [0.29, -0.36, -0.06], [0.04, 0.19, 0.09]))(p)
  return smin(smin(shoe, ramus, 0.05), ell(p, [0, -0.6, 0.46], [0.09, 0.06, 0.06]), 0.05)
}

// Negative inside the bone, positive outside, zero on the surface.
export function skullSdf(p) {
  // The vault sits up and back. It used to come down far enough to
  // swallow the face from the side, and the whole thing read as a bulb.
  let d = ell(p, [0, 0.28, -0.08], [0.5, 0.46, 0.6]) // cranium
  // The upper face: cut off flat underneath, where the upper teeth sit,
  // so there is a mouth rather than one lump from brow to chin.
  const face = Math.max(ell(p, [0, -0.12, 0.3], [0.34, 0.34, 0.32]), -(p[1] + 0.38))
  d = smin(d, face, 0.12)
  d = smin(d, both((q) => ell(q, [0.36, -0.06, 0.3], [0.12, 0.09, 0.17]))(p), 0.06) // cheekbones
  d = smin(d, both((q) => rod(q, [0.4, -0.06, 0.26], [0.44, -0.05, -0.06], 0.04))(p), 0.05) // arches
  d = smin(d, ell(p, [0, 0.1, 0.5], [0.33, 0.06, 0.12]), 0.06) // brow ridge
  d = Math.max(d, -holes(p))
  d = Math.min(d, teeth(p))
  d = smin(d, jaw(p), 0.03)
  return d
}

const grad = (p, h = 1e-3) =>
  [0, 1, 2].map((k) => {
    const a = p.slice()
    const b = p.slice()
    a[k] += h
    b[k] -= h
    return (skullSdf(a) - skullSdf(b)) / (2 * h)
  })

// Walk a point onto the surface along the gradient. Returns null if it
// will not settle — a point that started in a crease can oscillate.
function settle(p) {
  for (let i = 0; i < 8; i++) {
    const d = skullSdf(p)
    if (Math.abs(d) < 0.002) break
    const g = grad(p)
    const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]
    if (g2 < 1e-9) return null
    p = p.map((v, k) => v - (d * g[k]) / g2)
  }
  return Math.abs(skullSdf(p)) < 0.01 && Math.hypot(p[0], p[1], p[2]) <= 1 ? p : null
}

// Points everywhere, and extra round the holes and on the teeth. The
// rest of what makes it read is done when it is drawn: each point carries
// the surface's normal, and the shader lights the ones you see edge on.
// That is how glass and x-rays look — bright where the surface turns away
// from you, faint where it faces you — and it picks out the outline, the
// sockets and the jaw from whichever side you are looking.
export function skull({ seed = 11, count = 6000 } = {}) {
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  const size = new Float32Array(count)
  let n = 0
  while (n < count) {
    const p = settle([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1])
    if (!p) continue
    const feature = Math.abs(holes(p)) < 0.05 || teeth(p) < 0.01 || jaw(p) < 0.01
    if (!feature && rand() > 0.55) continue
    const g = grad(p)
    const l = Math.hypot(g[0], g[1], g[2]) || 1
    for (let k = 0; k < 3; k++) {
      pos[n * 3 + k] = p[k]
      normal[n * 3 + k] = g[k] / l
    }
    size[n] = 0.6 + 0.8 * rand()
    n++
  }
  return { pos, normal, size, radius: 1 }
}

// ============================================================
// the brain
// ============================================================

// The space the neurons and the projects live in: an ellipsoid well
// inside the cranium, so nothing ever pokes through the bone.
export const BRAIN = { c: [0, 0.28, -0.12], r: [0.4, 0.36, 0.48] }

export function inBrain(p, shrink = 1) {
  const x = (p[0] - BRAIN.c[0]) / (BRAIN.r[0] * shrink)
  const y = (p[1] - BRAIN.c[1]) / (BRAIN.r[1] * shrink)
  const z = (p[2] - BRAIN.c[2]) / (BRAIN.r[2] * shrink)
  return x * x + y * y + z * z <= 1 + 1e-6
}

// Outward, at p — the direction to bounce a neuron off the inside of the
// brain rather than let it out.
function brainNormal(p) {
  const n = [0, 1, 2].map((k) => (p[k] - BRAIN.c[k]) / (BRAIN.r[k] * BRAIN.r[k]))
  const l = Math.hypot(n[0], n[1], n[2]) || 1
  return n.map((v) => v / l)
}

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return v.map((x) => x / l)
}

const STEP = 0.035
const KEEP = 0.85 // how much of its direction a neuron keeps each step
const FORK = 0.07
const DEPTH = 3

// Branching walks from a handful of roots. Returned as line segments —
// two vertices each, as THREE.LineSegments wants — with `along`, how far
// down its own branch a vertex is (0 at the root, 1 at the tip), and a
// `phase` per branch. A pulse is drawn where along matches the time plus
// the phase, so it runs root to tip and no two branches fire together.
export function neurons({ seed = 5, seeds = 36 } = {}) {
  const rand = rng(seed)
  const pos = []
  const along = []
  const phase = []

  const grow = (start, dir, steps, depth) => {
    const ph = rand()
    let p = start
    let d = dir
    for (let i = 0; i < steps; i++) {
      d = norm(d.map((v) => v * KEEP + gauss(rand) * (1 - KEEP)))
      let q = p.map((v, k) => v + d[k] * STEP)
      if (!inBrain(q)) {
        const n = brainNormal(p)
        const dot = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]
        d = norm(d.map((v, k) => v - 2 * dot * n[k]))
        q = p.map((v, k) => v + d[k] * STEP)
        if (!inBrain(q)) return
      }
      pos.push(...p, ...q)
      along.push(i / steps, (i + 1) / steps)
      phase.push(ph, ph)
      if (depth < DEPTH && rand() < FORK) {
        const side = norm(d.map((v) => v + gauss(rand) * 0.9))
        grow(q, side, Math.ceil((steps - i) / 2), depth + 1)
      }
      p = q
    }
  }

  for (let s = 0; s < seeds; s++) {
    let root
    do {
      root = BRAIN.c.map((c, k) => c + (rand() * 2 - 1) * BRAIN.r[k] * 0.8)
    } while (!inBrain(root, 0.8))
    grow(root, norm([gauss(rand), gauss(rand), gauss(rand)]), 18 + Math.floor(rand() * 23), 0)
  }

  return {
    pos: new Float32Array(pos),
    along: new Float32Array(along),
    phase: new Float32Array(phase),
  }
}

// ============================================================
// where the projects travel
// ============================================================

// One small tilted loop each, their centres spread round a ring. A ring
// of 0.21 and loops of 0.05 keep any two projects at least 0.26 apart at
// every moment, which is what stops their labels landing on each other.
const LOOP_RING = 0.21
const LOOP_R = 0.05

export function loops(n, { seed = 9 } = {}) {
  const rand = rng(seed)
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n
    return {
      c: [
        BRAIN.c[0] + LOOP_RING * Math.cos(a),
        BRAIN.c[1] + LOOP_RING * 0.4 * Math.sin(a),
        BRAIN.c[2] + LOOP_RING * Math.sin(a),
      ],
      r: LOOP_R,
      tilt: [(rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6],
      spin: 0.04, // turns a second
      offset: i / n,
    }
  })
}

// Where a project is, t turns into its loop. Period one.
export function loopAt(loop, t) {
  const a = 2 * Math.PI * (t + loop.offset)
  let x = loop.r * Math.cos(a)
  let y = 0
  let z = loop.r * Math.sin(a)
  const [tx, tz] = loop.tilt
  ;[y, z] = [y * Math.cos(tx) - z * Math.sin(tx), y * Math.sin(tx) + z * Math.cos(tx)]
  ;[x, y] = [x * Math.cos(tz) - y * Math.sin(tz), x * Math.sin(tz) + y * Math.cos(tz)]
  return [loop.c[0] + x, loop.c[1] + y, loop.c[2] + z]
}
