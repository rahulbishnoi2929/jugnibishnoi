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

// A rounded rod from a to b.
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

// Union with a fillet, so one bone grows out of the next; and its
// opposite, for carving with a rounded edge rather than a sharp one.
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a, b, k) => -smin(-a, -b, k)

// The left side, mirrored: a skull is symmetric, so every paired bone is
// described once.
const both = (f) => (p) => Math.min(f(p), f([-p[0], p[1], p[2]]))

// Signed distance to a 2D polygon (Inigo Quilez's), for bones that are
// flat plates with a real outline rather than blobs.
function poly(x, y, pts) {
  let d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2
  let s = 1
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[j]
    const ex = bx - ax
    const ey = by - ay
    const wx = x - ax
    const wy = y - ay
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    d = Math.min(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2)
    const c1 = y >= ay
    const c2 = y < by
    const c3 = ex * wy > ey * wx
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s
  }
  return s * Math.sqrt(d)
}

// A 2D shape given thickness: a flat bone.
const extrude = (d2, dz, round) =>
  Math.hypot(Math.max(d2, 0), Math.max(dz, 0)) + Math.min(Math.max(d2, dz), 0) - round

// ------------------------------------------------------------
// Built in millimetres, from an average adult skull, then scaled down.
//
//   cranial length 185, breadth 140, vertex to chin 225
//   eye sockets 40 wide, 35 tall, 25 apart; nose opening 25 by 35
//   cheekbone to cheekbone 130; jaw corner to corner 100
//   the ear canal level with the bottom of the eye sockets — the
//   Frankfurt plane, which is y = 0 here
//
// x is across, y is up, z is forward. The first attempt was a dozen
// blobs placed by eye, and it looked like a lightbulb wearing a face.
// ------------------------------------------------------------
const MM = 120 // millimetres per unit

const cranium = (p) =>
  smin(
    ell(p, [0, 25, -28], [70, 66, 78]), // the back of the vault, widest
    ell(p, [0, 32, 18], [58, 58, 66]), // the forehead, narrower
    20,
  )

// The upper face: brow, cheekbones and their arches, the upper jaw.
const brow = both((p) => rod(p, [0, 37, 78], [40, 36, 67], 5))
// The cheekbone, and the arch running back from it to just in front of
// the ear: a band, taller than it is thick, not a round rod.
const cheek = both((p) =>
  smin(
    ell(p, [47, -3, 52], [14, 11, 14]),
    smin(rod(p, [56, 2, 44], [61, 2, -6], 3), rod(p, [56, -5, 44], [61, -4, -6], 3), 5),
    10,
  ),
)
const maxilla = (p) => Math.max(ell(p, [0, -14, 42], [46, 38, 34]), -(p[1] + 40))
const nasalBones = (p) => rod(p, [0, 33, 80], [0, 15, 84], 5)
// Behind and below each ear, the bump you can feel behind your own.
const mastoid = both((p) => ell(p, [53, -18, -30], [6, 9, 7]))

// What is carved out, with rounded rims.
const orbit = both((p) => ell(p, [32, 17, 64], [19, 17, 30]))
// The nasal opening is a pear standing on its point: narrow under the
// nasal bones, widest just above the teeth.
const nose = (p) => Math.min(ell(p, [0, -8, 74], [12.5, 10, 24]), ell(p, [0, 5, 74], [7, 12, 24]))
// The ear canal: a short tube into the side of the head, level with the
// bottom of the eye sockets.
const ear = both((p) => Math.max(Math.hypot(p[1] + 2, p[2] + 18) - 5, 50 - p[0]))

// Fourteen teeth in each jaw along the dental arch, meeting at y = -47.
const toothAt = (s) => [27 * s, 66 - 36 * s * s]
const teethMM = (p) => {
  if (p[1] > -30 || p[1] < -66 || p[2] < 18) return 30
  let d = Infinity
  for (let i = 0; i < 14; i++) {
    const s = -1 + (2 * i + 1) / 14
    const [x, z] = toothAt(s)
    const r = Math.abs(s) < 0.3 ? [3.6, 5.6, 2.6] : [4.6, 5, 5]
    d = Math.min(d, ell(p, [x, -41.5, z], r), ell(p, [x * 0.95, -52.5, z - 1.5], r))
  }
  return d
}

// The lower jaw. The body is a wall bent along a parabola from chin to
// corners: distance to the curve across, distance to its band up and
// down, rounded at the edges. It is deeper at the chin than at the back.
const JAW_N = 16
const JAW = Array.from({ length: JAW_N + 1 }, (_, i) => {
  const s = -1 + (2 * i) / JAW_N
  return [50 * s, 64 - 56 * s * s, s]
})
function jawBody(p) {
  let best = Infinity
  let at = 0
  for (let i = 1; i < JAW.length; i++) {
    const [ax, az, as] = JAW[i - 1]
    const [bx, bz, bs] = JAW[i]
    const ex = bx - ax
    const ez = bz - az
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * ex + (p[2] - az) * ez) / (ex * ex + ez * ez)))
    const d = Math.hypot(p[0] - ax - ex * t, p[2] - az - ez * t)
    if (d < best) {
      best = d
      at = as + (bs - as) * t
    }
  }
  const front = 1 - at * at
  // The top edge, under the teeth, is nearly level; the bottom edge
  // drops from the corners to the chin, which is what makes a jaw a V
  // from the front rather than a box.
  const top = -55 - 3 * front
  const bottom = -70 - 16 * front
  const mid = (top + bottom) / 2
  const half = (top - bottom) / 2
  return extrude(best - 3, Math.abs(p[1] - mid) - half, 4)
}
// Each ramus is a flat plate in the side plane, traced from the real
// outline: up the back to the hinge, down into the notch, up to the
// coronoid tip under the cheek arch, and down the front.
// The back edge leans back as it rises: the angle of the jaw is about
// 120 degrees, not a right angle.
const RAMUS = [
  [8, -71],
  [-11, -10],
  [-2, -4],
  [5, -16],
  [15, -12],
  [17, -28],
  [22, -56],
]
const ramus = both((p) =>
  smin(
    extrude(poly(p[2], p[1], RAMUS) + 2, Math.abs(p[0] - 50) - 1.5, 4),
    ell(p, [50, -6, -6], [9, 5, 6]), // the condyle, in front of the ear
    4,
  ),
)
const jawMM = (p) => {
  // Nothing of the jaw is above the condyle, at y = -1: a lower bound on
  // the distance is enough up there, and it skips the curve search for
  // most of the head.
  if (p[1] > 4) return p[1] - 1
  let d = jawBody(p)
  d = smin(d, ell(p, [0, -79, 64], [12, 7, 6]), 6) // chin
  return smin(d, ramus(p), 8)
}

function skullMM(p) {
  let d = cranium(p)
  d = smin(d, maxilla(p), 14)
  d = smin(d, brow(p), 6)
  d = smin(d, cheek(p), 10)
  d = smin(d, nasalBones(p), 5)
  d = smin(d, mastoid(p), 12)
  d = smax(d, -orbit(p), 3)
  d = smax(d, -nose(p), 2)
  d = smax(d, -ear(p), 2)
  d = Math.min(d, teethMM(p))
  return smin(d, jawMM(p), 2)
}

// The same, in the unit space the rest of this file works in.
const mm = (p) => [p[0] * MM, p[1] * MM, p[2] * MM]
export const skullSdf = (p) => skullMM(mm(p)) / MM
const holes = (p) => Math.min(orbit(mm(p)), nose(mm(p)), ear(mm(p))) / MM
const teeth = (p) => teethMM(mm(p)) / MM
const jaw = (p) => jawMM(mm(p)) / MM

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
    // Most of the box is nowhere near bone. One look at the distance
    // throws those away before paying for the walk onto the surface.
    const q = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]
    if (Math.abs(skullSdf(q)) > 0.04) continue
    const p = settle(q)
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
// In millimetres it is centred at (0, 30, -14) with radii 50, 46, 64:
// inside the vault, behind the eye sockets.
export const BRAIN = { c: [0, 0.25, -0.117], r: [0.417, 0.383, 0.533] }

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
