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
function belt({ from, to, count, thickness, incSpread, tint, seed }) {
  const rand = rng(seed)
  const inner = orbitOf(from)
  const outer = orbitOf(to)
  const out = layer(count)
  for (let i = 0; i < count; i++) {
    const r = inner + (outer - inner) * rand()
    const theta = rand() * Math.PI * 2
    const p = rotX(
      [Math.cos(theta) * r, gauss(rand) * thickness, Math.sin(theta) * r],
      gauss(rand) * rad(incSpread)
    )
    // The same heavy tail as everywhere else: a belt of identical specks
    // is the flattest thing you can draw.
    const size = Math.min(4, 0.7 * Math.pow(1 - rand(), -0.3))
    const b = 0.45 + 0.55 * Math.min(1, (size - 0.5) / 2)
    put(out, i, p[0], p[1], p[2], [tint[0] * b, tint[1] * b, tint[2] * b], size)
  }
  return out
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
      from: 2.1, to: 3.3, count: 1600, thickness: 0.004, incSpread: 9,
      tint: [0.86, 0.8, 0.7], seed: 11,
    }),
    // 30-50 AU, beyond Neptune, thicker and more inclined as it really is.
    kuiper: belt({
      from: 30, to: 50, count: 1100, thickness: 0.02, incSpread: 16,
      tint: [0.72, 0.78, 0.9], seed: 23,
    }),
    // The sun's glow: one very large soft point, which is what a bright
    // source looks like through any lens. Two nested spheres — the first
    // attempt — read as two flat discs, because that is what they were.
    glow: (() => {
      const g = layer(1)
      put(g, 0, 0, 0, 0, [1.0, 0.86, 0.62], 1)
      return g
    })(),
  }
}

// ============================================================
// the galaxy
// ============================================================
//
// Rebuilt because the first one read as a logo, and it is worth being exact
// about why. It was sixteen thousand identical dots: one size, one
// brightness, four arms of equal strength wound at the same loose angle, a
// hard outer edge, and no dust. That is a decal of a galaxy. A photograph
// of one is mostly *unresolved* light — a smooth haze with a few resolved
// stars in front of it — cut by dark dust lanes and dotted with pink
// star-forming knots, fading out with no edge at all.
//
// So this builds four layers instead of one, from a real surface-density
// model rather than from a shape:
//
//   haze    a few thousand very large, very faint points. Additive, they
//           stack into the nebulosity that makes it look photographed.
//   stars   forty thousand small ones with a heavy-tailed size and
//           brightness distribution, because a star field is a magnitude
//           distribution and not a constant.
//   hii     pink knots along the arm ridges: star-forming regions, the
//           most recognisable single feature after the arms themselves.
//   bulge   a separate flattened spheroid, older and yellower, with the
//           core concentration on top of it.

// The Milky Way's own numbers, near enough: a pitch angle of about twelve
// degrees, two major arms with two weaker ones between them, and a disc
// whose light falls off exponentially with a scale length of about a
// quarter of the visible radius.
const PITCH = rad(12.5)
const ARM_R0 = 0.055 // where the arms are born, in stage radii
const DISC_H = 0.26 // exponential scale length
const DISC_Z = 0.021 // scale height, thin

// A logarithmic spiral: r = R0 * exp(theta * tan(pitch)). Inverted, this is
// the azimuth an arm has reached by a given radius.
const armPhase = (r) => Math.log(r / ARM_R0) / Math.tan(PITCH)

// Surface density at a point, as a multiple of the smooth disc.
//
// Two major arms and two minor ones at different phases, so the thing is
// not two-fold symmetric — symmetry is most of what made it look drawn.
//
// Then dust, trailing each major arm by a third of a radian. On a black
// background the only way to draw dust without a depth-sorted dark pass is
// as missing emission, and the way to do that is *multiplicatively*, the
// way extinction actually works. Subtracting it — the first attempt —
// drove the density straight through zero and cut two empty wedges out of
// the disc: measured, the lanes came out at three per cent of the arm peak
// when a real lane is a half to four-fifths dimming, and a hole reads as
// artificial in the other direction. Cubing the cosine narrows it from
// half the disc into an actual lane.
const DUST_LAG = 0.34
const INTER_ARM = 0.18 // the disc between the arms is dim, not empty

function armDensity(r, theta) {
  const p = armPhase(r)
  // No arms inside the bulge, and they fade out at the rim.
  const w = smoothstep(r, 0.05, 0.2) * (1 - smoothstep(r, 0.85, 1.25))
  const major = 0.8 * Math.cos(2 * (theta - p))
  const minor = 0.28 * Math.cos(4 * (theta - p) + 1.1)
  const arms = Math.max(INTER_ARM, 1 + w * (major + minor))
  const lane =
    1 - w * 0.62 * Math.pow(Math.max(0, Math.cos(2 * (theta - p - DUST_LAG))), 3)
  return arms * lane
}
const ARM_MAX = 2.1 // ceiling of the above, for rejection sampling

// Gamma(2, h) has probability density r*exp(-r/h), which is exactly an
// exponential disc seen face on — and it comes out of two uniforms with no
// rejection step and, more to the point, with no outer edge.
function discRadius(rand, h, ceiling = 1.25) {
  for (let i = 0; i < 40; i++) {
    const r = -h * (Math.log(1 - rand()) + Math.log(1 - rand()))
    if (r > 0.008 && r < ceiling) return r
  }
  return h
}

// A point in the disc, drawn from the density above.
function discSample(rand) {
  for (let i = 0; i < 60; i++) {
    const r = discRadius(rand, DISC_H)
    const theta = rand() * Math.PI * 2
    const d = armDensity(r, theta)
    if (rand() * ARM_MAX < d) return { r, theta, arm: d }
  }
  return { r: DISC_H, theta: rand() * Math.PI * 2, arm: 1 }
}

// Star colour by population: the arms are where new blue stars are, the
// spaces between them hold the old yellow ones. Real, and it is also the
// difference between a galaxy and a pinwheel of one colour.
const ARM_BLUE = [0.72, 0.82, 1.0]
const DISC_WARM = [1.0, 0.9, 0.72]
const BULGE_GOLD = [1.0, 0.82, 0.55]

export function galaxy({ seed = 7, radius = 1, stars = 34000 } = {}) {
  const rand = rng(seed)

  const disc = layer(stars)
  for (let i = 0; i < stars; i++) {
    const { r, theta, arm } = discSample(rand)
    // Young stars sit closer to the mid-plane than old ones.
    const young = Math.min(1, Math.max(0, (arm - 1) / 1.2))
    const z = gauss(rand) * DISC_Z * radius * (1.25 - 0.6 * young)

    // A heavy tail, so a handful of stars are much bigger and brighter than
    // the rest. This one line is most of the difference between a star
    // field and a texture.
    const size = Math.min(5, 0.8 * Math.pow(1 - rand(), -0.32))
    const bright = 0.42 + 0.58 * Math.min(1, (size - 0.5) / 2.2)

    const warm = mix(DISC_WARM, ARM_BLUE, young * 0.85)
    const jitter = 0.88 + rand() * 0.24
    put(disc, i, r * radius * Math.cos(theta), z, r * radius * Math.sin(theta), [
      warm[0] * bright * jitter,
      warm[1] * bright * jitter,
      warm[2] * bright,
    ], size)
  }

  // The unresolved light. Few points, enormous and nearly transparent; it
  // is the additive stack of them that reads as a photograph.
  // More, smaller blobs rather than fewer huge ones: the huge ones ran
  // into the 63-pixel cap some drivers put on gl_PointSize, and they cost
  // a fortune in overdraw for a layer that is barely visible.
  const hazeCount = Math.round(stars * 0.18)
  const haze = layer(hazeCount)
  for (let i = 0; i < hazeCount; i++) {
    const { r, theta, arm } = discSample(rand)
    const young = Math.min(1, Math.max(0, (arm - 1) / 1.2))
    const c = mix(DISC_WARM, ARM_BLUE, young * 0.6)
    put(
      haze,
      i,
      r * radius * Math.cos(theta),
      gauss(rand) * DISC_Z * radius * 1.4,
      r * radius * Math.sin(theta),
      [c[0], c[1], c[2]],
      // Bigger further out, where the light is more diffuse.
      4 + rand() * 7 + r * 9
    )
  }

  // Star-forming regions, packed onto the arm ridges rather than spread
  // through the disc — the pink knots in every galaxy photograph.
  const hiiCount = Math.round(stars * 0.014)
  const hii = layer(hiiCount)
  for (let i = 0; i < hiiCount; i++) {
    let s = discSample(rand)
    // Take the strongest of a few tries, which concentrates them on the
    // ridge lines without needing a separate density function.
    for (let k = 0; k < 5; k++) {
      const t = discSample(rand)
      if (t.arm > s.arm) s = t
    }
    // Star-forming regions vary enormously in size — 30 Doradus against
    // the small ones — so they get a tail like everything else. A uniform
    // range made them a row of identical pink beads.
    const heat = 0.6 + rand() * 0.4
    put(
      hii,
      i,
      s.r * radius * Math.cos(s.theta),
      gauss(rand) * DISC_Z * radius * 0.5,
      s.r * radius * Math.sin(s.theta),
      [1.0 * heat, 0.42 * heat, 0.52 * heat],
      Math.min(7, 1.8 * Math.pow(1 - rand(), -0.28))
    )
  }

  // The bulge: older, rounder, yellower, and much more concentrated.
  const bulgeCount = Math.round(stars * 0.22)
  const bulge = layer(bulgeCount)
  for (let i = 0; i < bulgeCount; i++) {
    // Capped, or the exponential tail scatters bulge stars out to two
    // thirds of the disc and the "bulge" is just a second disc.
    const r = discRadius(rand, 0.055, 0.4) * radius
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    const size = Math.min(4, 0.7 * Math.pow(1 - rand(), -0.3))
    const bright = 0.5 + 0.5 * Math.min(1, (size - 0.5) / 2)
    const j = 0.9 + rand() * 0.2
    put(
      bulge,
      i,
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.58, // flattened, as bulges are
      r * Math.sin(phi) * Math.sin(theta),
      [BULGE_GOLD[0] * bright * j, BULGE_GOLD[1] * bright * j, BULGE_GOLD[2] * bright],
      size
    )
  }

  // The sun: two thirds out, on the inner edge of an arm, which is where it
  // actually is. Marking it is the point of the whole stage.
  const sunR = radius * 0.63
  const sunTheta = armPhase(0.63) + 0.24
  const sun = [
    sunR * Math.cos(sunTheta),
    0.004 * radius,
    sunR * Math.sin(sunTheta),
  ]

  return {
    id: 'galaxy',
    radius,
    tilt: [0.46, 0, 0.12],
    layers: { haze, bulge, disc, hii },
    sun,
    anchor: sun,
    // Kept for the tests, which measure the resolved stars.
    pos: disc.pos,
    col: disc.col,
  }
}

// ============================================================
// the observable universe
// ============================================================

// Galaxies hang in a web, so this places clusters first and hangs members
// off them, with faint filaments between neighbours. Without the clustering
// it reads as television static.
//
// Each galaxy also gets its own size and brightness, because at this scale
// what you are looking at is a magnitude distribution too — a few nearby
// bright ones over a haze of faint distant ones.
export function universe({
  clusters = 130,
  perCluster = 18,
  field = 420,
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
  const gal = layer(count)
  let n = 0

  const add = (x, y, z) => {
    // Heavy tail again: most are specks, a few are obviously galaxies.
    const size = Math.min(6, 0.9 * Math.pow(1 - rand(), -0.33))
    const bright = 0.4 + 0.6 * Math.min(1, (size - 0.6) / 2.5)
    // Redder the fainter, which is both roughly true and stops the field
    // reading as one flat grey.
    const warmth = 1 - bright
    put(gal, n++, x, y, z, [
      (0.78 + warmth * 0.22) * bright,
      (0.8 - warmth * 0.06) * bright,
      (0.9 - warmth * 0.24) * bright,
    ], size)
  }

  for (const [cx, cy, cz] of centres) {
    const spread = radius * (0.028 + rand() * 0.05)
    for (let i = 0; i < perCluster; i++) {
      add(cx + gauss(rand) * spread, cy + gauss(rand) * spread, cz + gauss(rand) * spread)
    }
  }
  // A thin scatter between the clusters, so the voids are not empty.
  for (let i = 0; i < field; i++) {
    const r = radius * Math.cbrt(rand())
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    add(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi)
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
    layers: { gal },
    web: new Float32Array(web),
    home: centres[0],
    anchor: centres[0],
    pos: gal.pos,
    col: gal.col,
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
// Halfway out from his planet the solar system is a quarter of the frame
// and the galaxy has not arrived; without a sky behind it, that reads as a
// bug rather than as distance.
export function starfield({ count = 2200, radius = 320, seed = 31 } = {}) {
  const rand = rng(seed)
  const sky = layer(count)
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    // Same magnitude distribution as everywhere else.
    const size = Math.min(4, 0.75 * Math.pow(1 - rand(), -0.3))
    const b = 0.3 + 0.7 * Math.min(1, (size - 0.5) / 2)
    // A little colour: most stars are white-ish, some orange, a few blue.
    const hue = rand()
    const c =
      hue < 0.62
        ? [1, 0.97, 0.92]
        : hue < 0.86
          ? [1, 0.86, 0.7]
          : [0.82, 0.88, 1]
    put(
      sky,
      i,
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      [c[0] * b, c[1] * b, c[2] * b],
      size
    )
  }
  return { ...sky, radius }
}

// ---------- layer plumbing ----------

// Every point cloud out here is positions, colours and a per-point size
// multiplier. The size is what the first version was missing.
function layer(count) {
  return {
    pos: new Float32Array(count * 3),
    col: new Float32Array(count * 3),
    siz: new Float32Array(count),
    count,
  }
}

function put(l, i, x, y, z, col, size) {
  l.pos[i * 3] = x
  l.pos[i * 3 + 1] = y
  l.pos[i * 3 + 2] = z
  l.col[i * 3] = col[0]
  l.col[i * 3 + 1] = col[1]
  l.col[i * 3 + 2] = col[2]
  l.siz[i] = size
}

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

function smoothstep(x, min, max) {
  const t = Math.max(0, Math.min(1, (x - min) / (max - min)))
  return t * t * (3 - 2 * t)
}

// What each stage calls itself on the way out.
export const CAPTIONS = {
  solar: ['The Solar System', 'he is on the third one'],
  galaxy: ['The Milky Way', 'the sun is one of a hundred billion'],
  universe: ['The Observable Universe', 'every point here is a galaxy'],
}
