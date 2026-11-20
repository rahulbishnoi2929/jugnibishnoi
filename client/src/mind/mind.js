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

// Union with a fillet, so the face grows out of the cranium rather than
// being stuck on to it.
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

// What is carved out: the eye sockets and the nose. Kept apart from the
// rest because the edges of these are what make a skull read as a skull,
// and the sampler below leans on them.
const HOLES = [
  { c: [0.2, -0.05, 0.62], r: [0.15, 0.15, 0.15] },
  { c: [-0.2, -0.05, 0.62], r: [0.15, 0.15, 0.15] },
  { c: [0, -0.28, 0.64], r: [0.07, 0.1, 0.1] },
]
const holes = (p) => Math.min(...HOLES.map((h) => ell(p, h.c, h.r)))

// Negative inside the bone, positive outside, zero on the surface.
export function skullSdf(p) {
  let d = ell(p, [0, 0.15, -0.05], [0.62, 0.6, 0.72]) // cranium
  d = smin(d, ell(p, [0, -0.2, 0.28], [0.45, 0.42, 0.42]), 0.15) // face
  d = smin(d, ell(p, [0.38, -0.15, 0.3], [0.16, 0.1, 0.18]), 0.08) // cheekbones
  d = smin(d, ell(p, [-0.38, -0.15, 0.3], [0.16, 0.1, 0.18]), 0.08)
  d = smin(d, ell(p, [0, -0.55, 0.22], [0.36, 0.2, 0.36]), 0.1) // jaw
  return Math.max(d, -holes(p))
}

// Walk a point onto the surface along the gradient. Returns null if it
// will not settle — a point that started in a crease can oscillate.
function settle(p) {
  const h = 1e-3
  for (let i = 0; i < 6; i++) {
    const d = skullSdf(p)
    if (Math.abs(d) < 0.002) break
    const g = [0, 1, 2].map((k) => {
      const a = p.slice()
      const b = p.slice()
      a[k] += h
      b[k] -= h
      return (skullSdf(a) - skullSdf(b)) / (2 * h)
    })
    const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]
    if (g2 < 1e-9) return null
    p = p.map((v, k) => v - (d * g[k]) / g2)
  }
  return Math.abs(skullSdf(p)) < 0.01 && Math.hypot(p[0], p[1], p[2]) <= 1 ? p : null
}

// Teeth: a share of the points kept back for little clusters along the
// arc of the upper jaw. Settled onto the surface like everything else, so
// they come out as a row of bumps rather than floating dots.
const TEETH = 14
const TEETH_SHARE = 0.04

export function skull({ seed = 11, count = 6000 } = {}) {
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  let n = 0
  const put = (p) => {
    if (n >= count) return
    pos[n * 3] = p[0]
    pos[n * 3 + 1] = p[1]
    pos[n * 3 + 2] = p[2]
    size[n] = 0.6 + 0.8 * rand()
    n++
  }

  const teeth = Math.round(count * TEETH_SHARE)
  while (n < teeth) {
    const a = -0.9 + 1.8 * (Math.floor(rand() * TEETH) / (TEETH - 1))
    const p = settle([
      0.3 * Math.sin(a) + gauss(rand) * 0.015,
      -0.42 + gauss(rand) * 0.015,
      0.22 + 0.3 * Math.cos(a) + gauss(rand) * 0.015,
    ])
    if (p) put(p)
  }

  while (n < count) {
    const p = settle([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1])
    if (!p) continue
    put(p)
    // Twice over at the rim of a socket or the nose: an even scatter
    // makes a smooth egg, and it is the edges that say "skull".
    if (Math.abs(holes(p)) < 0.04) {
      const q = settle(p.map((v) => v + (rand() - 0.5) * 0.01))
      if (q) put(q)
    }
  }

  return { pos, size, radius: 1 }
}

// ============================================================
// the brain
// ============================================================

// The space the neurons and the projects live in: an ellipsoid well
// inside the cranium, so nothing ever pokes through the bone.
export const BRAIN = { c: [0, 0.18, -0.05], r: [0.5, 0.46, 0.58] }

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
// of 0.28 and loops of 0.1 keep any two projects at least 0.28 apart at
// every moment, which is what stops their labels landing on each other.
const LOOP_RING = 0.28
const LOOP_R = 0.1

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
