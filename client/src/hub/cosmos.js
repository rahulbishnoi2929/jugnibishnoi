// The three scales past his planet, as plain arrays of points.
//
// Pure functions with no React and no scene objects, so they can be run and
// asserted under node — the frame loop is not observable in the pane this
// was built in, and a sky full of NaN would look exactly like a sky that
// had not loaded.
//
// Everything is drawn in the site's own idiom: line work and points, no
// textures, no image assets.
//
// Each stage declares its own `radius`, and Cosmos scales it by
// fitRadius / radius so it lands at a known fraction of the frame. Local
// units are therefore arbitrary and only ratios within a stage matter —
// which is what lets the solar system be built from real orbital elements
// and still fit on a phone.

// Seeded, so the sky is the same sky every time you come back to it and a
// test can assert on it. mulberry32.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller, for scatter that falls off rather than stopping dead.
function gauss(rand) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const rad = (deg) => (deg * Math.PI) / 180

// y-up rotations, so this module stays free of three.
const rotY = (p, t) => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]
}
const rotX = (p, t) => {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}

// ============================================================
// the solar system
// ============================================================
//
// Real orbital elements at J2000, from the JPL planetary factsheet:
// semi-major axis in AU, eccentricity, inclination to the ecliptic and
// longitude of the ascending node in degrees, longitude of perihelion and
// mean longitude in degrees, equatorial radius in Earth radii.
//
// The elements are real. The two scales are not, and cannot be: Neptune's
// orbit is 78 times Mercury's, and the sun is 109 Earths across. Drawn
// truthfully at a size where Neptune fits on a phone, Mercury's orbit would
// be four pixels and Earth would be a fifth of one. So the distances are
// compressed logarithmically and the bodies by a power law — see orbitOf
// and bodyOf, which both say why. Every printed diagram of the solar system
// breaks scale somewhere; this one says where.
export const PLANETS = [
  { name: 'Mercury', a: 0.3871, e: 0.2056, inc: 7.00, node: 48.33, peri: 77.46, lon: 252.25, r: 0.383, color: '#9c8f83' },
  { name: 'Venus',   a: 0.7233, e: 0.0068, inc: 3.39, node: 76.68, peri: 131.60, lon: 181.98, r: 0.949, color: '#d9b57e' },
  { name: 'Earth',   a: 1.0000, e: 0.0167, inc: 0.00, node: 0.00,  peri: 102.95, lon: 100.46, r: 1.000, color: '#d4a72c' },
  { name: 'Mars',    a: 1.5237, e: 0.0934, inc: 1.85, node: 49.56, peri: 336.04, lon: 355.43, r: 0.532, color: '#c1552f' },
  { name: 'Jupiter', a: 5.2044, e: 0.0489, inc: 1.30, node: 100.46, peri: 14.75, lon: 34.35,  r: 10.97, color: '#c9a882' },
  { name: 'Saturn',  a: 9.5826, e: 0.0565, inc: 2.49, node: 113.66, peri: 92.43, lon: 50.08,  r: 9.140, color: '#d8c68f' },
  { name: 'Uranus',  a: 19.201, e: 0.0472, inc: 0.77, node: 74.00, peri: 170.96, lon: 314.06, r: 3.981, color: '#96c7cd' },
  { name: 'Neptune', a: 30.047, e: 0.0086, inc: 1.77, node: 131.78, peri: 44.97, lon: 304.35, r: 3.865, color: '#5b7fd4' },
]

const AU_MAX = 30.047 // Neptune, which defines the stage's unit radius

// Orbit compression: log, not power.
//
// A power law was the first attempt and it cannot work here, because a
// power law preserves ratios — Venus and Earth are 0.72 AU apart in ratio
// whatever exponent you pick, so their drawn gap stayed at four pixels on a
// phone while their dots were two pixels each. They touched.
//
// log(1 + a/c) spreads the inner system instead of scaling it, and the
// offset c keeps Mercury clear of the sun rather than mapping it to zero.
// Measured on a 375px phone: it takes the Venus-to-Earth gap from four
// pixels to eight, which is what makes the inner four readable as four
// things. Every printed diagram of the solar system breaks scale somewhere;
// this is where and how this one does it.
// 0.15 rather than 0.3: it pushes Mercury from 28 to 37 pixels out on a
// phone, which is what clears it of the sun's halo at 19.
const ORBIT_C = 0.15 // AU
export const orbitOf = (au) =>
  Math.log1p(au / ORBIT_C) / Math.log1p(AU_MAX / ORBIT_C)

// Body compression, and the size Earth is drawn at. A power law is right
// here — it is the ordering that matters, not the gaps. 0.32 keeps Mercury
// visible without letting Jupiter swallow its own orbit, and the constant
// is set so Earth lands just under three pixels on the narrowest phone,
// which is the smallest a dot can be and still be a dot.
const BODY_K = 0.32
const EARTH_DOT = 0.018
export const bodyOf = (earths) => EARTH_DOT * Math.pow(earths, BODY_K)

const SUN_EARTHS = 109.2

// Kepler's equation, E - e sin E = M, by Newton. Five iterations is well
// past converged at these eccentricities; eight costs nothing.
function eccentricAnomaly(M, e) {
  let E = M
  for (let i = 0; i < 8; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  }
  return E
}

// Perifocal to ecliptic, the standard chain: place the point in the orbit
// plane with the x axis towards perihelion, swing it round to the argument
// of perihelion, tip the plane by the inclination about the node line, then
// swing the node line to its longitude.
function toEcliptic(point, { inc, node, peri }) {
  const argument = rad(peri - node)
  let p = rotY(point, -argument)
  p = rotX(p, rad(inc))
  return rotY(p, -rad(node))
}

// One orbit as a closed loop of points, the sun at a focus.
function orbitPath(planet, segments = 180) {
  const a = orbitOf(planet.a)
  const b = a * Math.sqrt(1 - planet.e * planet.e)
  const c = a * planet.e // focus offset, so the sun lands at the origin
  const out = []
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2
    const local = [a * Math.cos(E) - c, 0, b * Math.sin(E)]
    out.push(toEcliptic(local, planet))
  }
  return out
}

// Where a planet actually is, for the mean longitude given in the table.
function planetAt(planet) {
  const a = orbitOf(planet.a)
  const b = a * Math.sqrt(1 - planet.e * planet.e)
  const M = rad(planet.lon - planet.peri)
  const E = eccentricAnomaly(M, planet.e)
  return toEcliptic([a * Math.cos(E) - a * planet.e, 0, b * Math.sin(E)], planet)
}

// The main belt is genuinely 2.1 to 3.3 AU, which under the same
// compression lands exactly in the gap between Mars and Jupiter. Nothing
// here is placed by eye.
function belt({ from, to, count, thickness, incSpread, seed }) {
  const rand = rng(seed)
  const inner = orbitOf(from)
  const outer = orbitOf(to)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = inner + (outer - inner) * rand()
    const theta = rand() * Math.PI * 2
    const p = rotX(
      [Math.cos(theta) * r, gauss(rand) * thickness, Math.sin(theta) * r],
      gauss(rand) * rad(incSpread)
    )
    pos[i * 3] = p[0]
    pos[i * 3 + 1] = p[1]
    pos[i * 3 + 2] = p[2]
  }
  return pos
}

// Saturn's rings: 1.11 to 2.27 Saturn radii, tilted 26.7 degrees, drawn as
// concentric circles because a ring of line work matches everything else
// here and a textured annulus would not.
function saturnRings(planet, at) {
  const body = bodyOf(planet.r)
  const out = []
  for (const k of [1.11, 1.35, 1.53, 1.95, 2.27]) {
    const r = body * k
    for (let i = 0; i < 64; i++) {
      const A = (i / 64) * Math.PI * 2
      const B = ((i + 1) / 64) * Math.PI * 2
      const p = rotX([Math.cos(A) * r, 0, Math.sin(A) * r], rad(26.7))
      const q = rotX([Math.cos(B) * r, 0, Math.sin(B) * r], rad(26.7))
      out.push(at[0] + p[0], at[1] + p[1], at[2] + p[2])
      out.push(at[0] + q[0], at[1] + q[1], at[2] + q[2])
    }
  }
  return new Float32Array(out)
}

export function solarSystem() {
  const planets = PLANETS.map((p) => ({
    name: p.name,
    color: p.color,
    size: bodyOf(p.r),
    orbit: orbitOf(p.a),
    pos: planetAt(p),
    path: orbitPath(p),
  }))

  const earth = planets[PLANETS.findIndex((p) => p.name === 'Earth')]
  const saturn = planets[PLANETS.findIndex((p) => p.name === 'Saturn')]

  return {
    id: 'solar',
    // Neptune sets the radius, not the Kuiper belt beyond it: a faint
    // scatter bleeding off the edge of the frame costs nothing and reads as
    // "it carries on", whereas fitting it would shrink every orbit by a
    // seventh to make room for the emptiest part of the picture.
    radius: 1,
    tilt: [0.34, 0, 0.06],
    // Earth is the anchor: the stage is slid so this point is the origin,
    // which is where his planet already is. Without it he shrinks into the
    // middle of the solar system, which is the sun.
    anchor: earth.pos,
    planets,
    sun: bodyOf(SUN_EARTHS),
    rings: saturnRings(PLANETS.find((p) => p.name === 'Saturn'), saturn.pos),
    // 2.1-3.3 AU, the real main belt.
    asteroids: belt({
      from: 2.1, to: 3.3, count: 900, thickness: 0.004, incSpread: 9, seed: 11,
    }),
    // 30-50 AU, beyond Neptune, thicker and more inclined as it really is.
    kuiper: belt({
      from: 30, to: 50, count: 700, thickness: 0.02, incSpread: 16, seed: 23,
    }),
  }
}

// ============================================================
// the galaxy
// ============================================================

// A four-armed log spiral with a bulge. The colour runs warm at the core to
// blue-white at the rim, which is both roughly true and this site's two
// accents at their extremes.
export function galaxy({ count = 16000, arms = 4, radius = 1, seed = 7 } = {}) {
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)

  const core = [0.94, 0.82, 0.52]
  const rim = [0.58, 0.71, 0.92]

  for (let i = 0; i < count; i++) {
    // A fifth of the stars are the bulge, packed into the middle.
    const bulge = i % 5 === 0
    let x, y, z, f

    if (bulge) {
      const r = radius * 0.13 * Math.pow(rand(), 0.55)
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      x = r * Math.sin(phi) * Math.cos(theta)
      z = r * Math.sin(phi) * Math.sin(theta)
      y = r * Math.cos(phi) * 0.45 // squashed, not a ball
      f = r / radius
    } else {
      const r = radius * Math.pow(rand(), 0.62)
      f = r / radius
      const arm = Math.floor(rand() * arms) * ((Math.PI * 2) / arms)
      // The twist is what makes it a spiral rather than a starfish.
      const theta = arm + f * 3.4 + gauss(rand) * 0.16 * (1.1 - f)
      const spread = radius * 0.023 * (1 - f * 0.6)
      x = Math.cos(theta) * r + gauss(rand) * spread
      z = Math.sin(theta) * r + gauss(rand) * spread
      // The disc is thin, and thinner further out.
      y = gauss(rand) * radius * 0.022 * (1 - f * 0.65)
    }

    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z

    const m = Math.min(1, f * 1.5)
    col[i * 3] = core[0] + (rim[0] - core[0]) * m
    col[i * 3 + 1] = core[1] + (rim[1] - core[1]) * m
    col[i * 3 + 2] = core[2] + (rim[2] - core[2]) * m
  }

  // The sun sits about two thirds out, on the inner edge of an arm. Marking
  // it is the point of the whole stage, and it is the anchor.
  const r = radius * 0.62
  const theta = 0.62 + 0.62 * 3.4
  const sun = [Math.cos(theta) * r, 0, Math.sin(theta) * r]

  return { id: 'galaxy', radius, tilt: [0.42, 0, 0.1], pos, col, sun, anchor: sun }
}

// ============================================================
// the observable universe
// ============================================================

// Galaxies are not scattered evenly, they hang in a web, so this places
// clusters first and then hangs members off them, with faint filaments
// between neighbours. Without the clustering it reads as television static.
export function universe({
  clusters = 110,
  perCluster = 16,
  field = 320,
  radius = 1,
  seed = 19,
} = {}) {
  const rand = rng(seed)

  const centres = []
  for (let i = 0; i < clusters; i++) {
    // Uniform through the volume of a ball, not just along its radius.
    const r = radius * Math.cbrt(rand())
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    centres.push([
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi),
    ])
  }

  const count = clusters * perCluster + field
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  let n = 0

  const put = (x, y, z, warmth) => {
    pos[n * 3] = x
    pos[n * 3 + 1] = y
    pos[n * 3 + 2] = z
    // A little variation so it does not read as one flat grey.
    col[n * 3] = 0.72 + warmth * 0.26
    col[n * 3 + 1] = 0.74 + warmth * 0.1
    col[n * 3 + 2] = 0.82 - warmth * 0.12
    n++
  }

  for (const [cx, cy, cz] of centres) {
    const spread = radius * (0.03 + rand() * 0.05)
    for (let i = 0; i < perCluster; i++) {
      put(cx + gauss(rand) * spread, cy + gauss(rand) * spread, cz + gauss(rand) * spread, rand())
    }
  }
  // A thin scatter between the clusters, so the voids are not empty.
  for (let i = 0; i < field; i++) {
    const r = radius * Math.cbrt(rand())
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    put(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi),
      rand()
    )
  }

  // Filaments: each cluster to its two nearest neighbours. Duplicates are
  // fine — they are drawn at an opacity where a doubled line is invisible.
  const web = []
  for (let i = 0; i < centres.length; i++) {
    const near = centres
      .map((c, j) => ({ j, d2: dist2(centres[i], c) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, 2)
    for (const { j } of near) web.push(...centres[i], ...centres[j])
  }

  return {
    id: 'universe',
    radius,
    tilt: [0.2, 0, 0],
    pos,
    col,
    web: new Float32Array(web),
    home: centres[0],
    anchor: centres[0],
  }
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

// ============================================================
// the backdrop
// ============================================================

// Stars, on a shell far enough out to sit behind every stage and never be
// scaled by one.
//
// This is what stops the space between two scales being an empty screen.
// Halfway between the solar system and the galaxy the solar system is a
// quarter of the frame and the galaxy has not arrived; without a sky behind
// it, that reads as a bug rather than as distance.
export function starfield({ count = 1600, radius = 320, seed = 31 } = {}) {
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = radius * Math.cos(phi)
    // Most stars are faint; a few are not. Squaring the roll does that.
    const b = 0.35 + 0.65 * Math.pow(rand(), 2)
    col[i * 3] = b
    col[i * 3 + 1] = b * 0.97
    col[i * 3 + 2] = b * 0.9
  }
  return { pos, col, radius }
}

// What each stage calls itself on the way out.
export const CAPTIONS = {
  solar: ['The Solar System', 'he is on the third one'],
  galaxy: ['The Milky Way', 'the sun is one of a hundred billion'],
  universe: ['The Observable Universe', 'every point here is a galaxy'],
}
