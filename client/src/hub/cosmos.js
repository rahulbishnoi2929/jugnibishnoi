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
// `tilt` is the real axial tilt in degrees and `bands` how strongly the
// planet is striped — the four gas and ice giants are, the rocky four are
// not. Together they are why Jupiter comes out banded across its equator
// and Uranus, tipped 98 degrees, comes out banded from pole to pole, which
// is the single oddest true fact about the solar system.
export const PLANETS = [
  { name: 'Mercury', a: 0.3871, e: 0.2056, inc: 7.00, node: 48.33, peri: 77.46, lon: 252.25, r: 0.383, tilt: 0.03, bands: 0, color: '#9c8f83' },
  { name: 'Venus',   a: 0.7233, e: 0.0068, inc: 3.39, node: 76.68, peri: 131.60, lon: 181.98, r: 0.949, tilt: 177.36, bands: 0, color: '#d9b57e' },
  { name: 'Earth',   a: 1.0000, e: 0.0167, inc: 0.00, node: 0.00,  peri: 102.95, lon: 100.46, r: 1.000, tilt: 23.44, bands: 0, color: '#5b8dbe' },
  { name: 'Mars',    a: 1.5237, e: 0.0934, inc: 1.85, node: 49.56, peri: 336.04, lon: 355.43, r: 0.532, tilt: 25.19, bands: 0, color: '#c1552f' },
  { name: 'Jupiter', a: 5.2044, e: 0.0489, inc: 1.30, node: 100.46, peri: 14.75, lon: 34.35,  r: 10.97, tilt: 3.13, bands: 1.0, color: '#c9a882' },
  { name: 'Saturn',  a: 9.5826, e: 0.0565, inc: 2.49, node: 113.66, peri: 92.43, lon: 50.08,  r: 9.140, tilt: 26.73, bands: 0.8, color: '#d8c68f' },
  { name: 'Uranus',  a: 19.201, e: 0.0472, inc: 0.77, node: 74.00, peri: 170.96, lon: 314.06, r: 3.981, tilt: 97.77, bands: 0.4, color: '#96c7cd' },
  { name: 'Neptune', a: 30.047, e: 0.0086, inc: 1.77, node: 131.78, peri: 44.97, lon: 304.35, r: 3.865, tilt: 28.32, bands: 0.5, color: '#5b7fd4' },
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
// which is the smallest a dot can be and still be a dot. It carries the
// same 1.2 the framing radius does, so widening the frame to fit the system
// around Earth did not quietly shrink every planet.
const BODY_K = 0.32
const EARTH_DOT = 0.0216
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

// Kept for the geometry that no longer uses it.
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
    bands: p.bands,
    // The spin axis, tipped from the orbital pole by the real obliquity and
    // swung round by the planet's own node so the eight are not all leaning
    // the same way. The shader stripes the planet about this, and Saturn's
    // rings lie in the plane perpendicular to it.
    axis: (() => {
      const e = rad(p.tilt)
      const l = rad(p.node)
      return [Math.sin(e) * Math.cos(l), Math.cos(e), Math.sin(e) * Math.sin(l)]
    })(),
  }))

  const earth = planets[PLANETS.findIndex((p) => p.name === 'Earth')]
  const saturn = planets[PLANETS.findIndex((p) => p.name === 'Saturn')]

  return {
    id: 'solar',
    // The radius the stage is framed by, and it is measured from Earth
    // rather than from the sun, because Earth is what sits at the middle of
    // the frame. Neptune's orbit is 1 and Earth is 0.38 out, so the far
    // side of the system is 1.38 away from him. 1.2 leaves the near side
    // comfortably inside and lets the far side of Neptune's orbit graze the
    // edge, with the Kuiper belt beyond it bleeding off — which is what
    // "it carries on" looks like.
    radius: 1.2,
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

// ---------- star colour ----------

// Stars are blackbodies, so their colour follows from one number: their
// temperature. Picking hex codes by eye — which is what the last version
// did — gets you a palette. This gets you a star field, and it is the
// single change that most makes one look photographed: a real field runs
// from orange dwarfs through white to a handful of blue-white giants, and
// the correlation between colour, size and brightness is what the eye
// reads as depth in a population.
//
// Tanner Helland's approximation of the Planckian locus, in sRGB. Checked
// against known stars: Proxima at 3050K comes out 255,179,113, the sun at
// 5778K comes out 255,242,231, Sirius at 9940K comes out 202,218,255.
export function blackbody(kelvin) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)]
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// One draw from a stellar population.
//
// `heavy` is the magnitude draw — a Pareto tail, so most stars are small
// and a few are much larger. Temperature rises with it, because on the main
// sequence the big ones are the hot ones, and so does brightness. Tying all
// three to one number is what stops the field looking like coloured
// confetti: the blue ones are also the big bright ones, as they are in
// every photograph.
function star(rand, { floor = 3000, spread = 1030, curve = 1.66, hot = 0 }) {
  const heavy = Math.min(5, 0.8 * Math.pow(1 - rand(), -0.32))
  const kelvin = floor + spread * Math.pow(heavy, curve) + hot
  // Over one at the top end on purpose: these layers are additive, so the
  // brightest stars saturating early is how they bloom.
  const bright = 0.42 + 0.93 * Math.min(1, Math.max(0, (heavy - 0.8) / 3.5))
  const c = blackbody(kelvin)
  const jitter = 0.92 + rand() * 0.16
  return {
    size: heavy,
    kelvin,
    col: [c[0] * bright * jitter, c[1] * bright * jitter, c[2] * bright],
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
// the azimuth an arm has reached by a given radius. Called a few hundred
// thousand times while sampling, so the tangent is not recomputed each
// time — that alone was a fifth of the build.
const TAN_PITCH = Math.tan(PITCH)
const armPhase = (r) => Math.log(r / ARM_R0) / TAN_PITCH

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

// Split in two so the parts that only depend on the radius — a logarithm
// and two smoothsteps — are computed once per sample rather than once per
// rejected azimuth.
const armWeight = (r) => smoothstep(r, 0.05, 0.2) * (1 - smoothstep(r, 0.85, 1.25))

function armDensity(w, p, theta) {
  const a = theta - p
  const major = 0.8 * Math.cos(2 * a)
  const minor = 0.28 * Math.cos(4 * a + 1.1)
  const arms = Math.max(INTER_ARM, 1 + w * (major + minor))
  const c = Math.max(0, Math.cos(2 * (a - DUST_LAG)))
  const lane = 1 - w * 0.62 * c * c * c
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

// A point in the disc, drawn from the density above. The radius is drawn
// once and only the azimuth is rejection-sampled, which is where all of
// the rejections happen anyway.
function discSample(rand) {
  const r = discRadius(rand, DISC_H)
  const w = armWeight(r)
  const p = armPhase(r)
  for (let i = 0; i < 32; i++) {
    const theta = rand() * Math.PI * 2
    const d = armDensity(w, p, theta)
    if (rand() * ARM_MAX < d) return { r, theta, arm: d }
  }
  return { r, theta: rand() * Math.PI * 2, arm: 1 }
}

// Where the new hot stars are. The arms hold them; the spaces between and
// the bulge hold the old cool ones. This is a temperature bias rather than
// two hand-picked colours, so the whole population comes out of blackbody.
const ARM_HEAT = 7200 // extra kelvin at the middle of an arm

export function galaxy({ seed = 7, radius = 1, stars = 24000 } = {}) {
  const rand = rng(seed)

  const disc = layer(stars)
  for (let i = 0; i < stars; i++) {
    const { r, theta, arm } = discSample(rand)
    // Young stars sit closer to the mid-plane than old ones.
    const young = Math.min(1, Math.max(0, (arm - 1) / 1.2))
    const z = gauss(rand) * DISC_Z * radius * (1.25 - 0.6 * young)

    const s = star(rand, { hot: young * ARM_HEAT })
    put(disc, i, r * radius * Math.cos(theta), z, r * radius * Math.sin(theta), s.col, s.size)
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
    // Unresolved light is the sum of a population, so it sits near the
    // middle of one: warm, and a little bluer inside an arm.
    const c = blackbody(4200 + young * 2600)
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
    // Old and cool: no hot young stars left in a bulge, so the curve is
    // flatter and the floor lower than the disc's.
    const s = star(rand, { floor: 2900, spread: 620, curve: 1.3 })
    put(
      bulge,
      i,
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.58, // flattened, as bulges are
      r * Math.sin(phi) * Math.sin(theta),
      s.col,
      s.size
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

  // The nucleus. Every spiral has a small very bright core on top of its
  // bulge, and without one the middle of this just looked like more disc.
  // One large soft point, the same trick as the sun's glow.
  const nucleus = layer(1)
  put(nucleus, 0, 0, 0, 0, blackbody(4600).map((v) => v * 1.25), 1)

  return {
    id: 'galaxy',
    // How far the disc itself reaches, which is not the same as the radius
    // it is framed by.
    extent: radius,
    // Framed from the sun, not from the core. The sun is 0.63 of the way
    // out, so the far rim is 1.63 away from him and the near rim only
    // 0.37. Fitting all of that would draw the galaxy at 60 per cent of the
    // size it deserves; 1.35 puts the core about half a frame off centre
    // with the far rim running off the edge, which is what being inside a
    // galaxy looks like.
    radius: radius * 1.35,
    tilt: [0.46, 0, 0.12],
    layers: { haze, nucleus, bulge, disc, hii },
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
  // A galaxy is a disc seen at some random angle, so most of them are
  // ellipses. Round dots — the last version — read as stars, which is
  // exactly the wrong thing at this scale. These two go to the shader,
  // which squashes and turns each point's falloff.
  gal.asp = new Float32Array(count)
  gal.ang = new Float32Array(count)
  let n = 0

  const add = (x, y, z) => {
    // Heavy tail again: most are specks, a few are obviously galaxies.
    const size = Math.min(6, 0.9 * Math.pow(1 - rand(), -0.33))
    const bright = 0.4 + 0.6 * Math.min(1, (size - 0.6) / 2.5)
    // Fainter means further means redder, which is both roughly true and
    // what stops the field reading as one flat grey.
    const warmth = 1 - bright
    // cos of a uniformly random inclination: face-on is rare, edge-on is
    // common, which is why deep fields are full of slivers.
    const aspect = 0.22 + 0.78 * Math.abs(Math.cos(Math.acos(2 * rand() - 1)))
    gal.asp[n] = aspect
    gal.ang[n] = rand() * Math.PI
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

  // Ours is the cluster nearest the middle. Taking the first one drawn
  // meant the whole field was framed around a random corner of itself.
  let home = 0
  for (let i = 1; i < centres.length; i++) {
    if (dist2(centres[i], [0, 0, 0]) < dist2(centres[home], [0, 0, 0])) home = i
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
    // Framed from our own cluster, which is near enough the middle that
    // this barely differs from the radius itself.
    radius: radius + Math.sqrt(dist2(centres[home], [0, 0, 0])),
    tilt: [0.2, 0, 0],
    layers: { gal },
    web: new Float32Array(web),
    home: centres[home],
    anchor: centres[home],
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
// The galactic plane, as a unit normal. Tilted so the band does not line
// up with any stage's own tilt.
const GALACTIC_POLE = (() => {
  const y = Math.cos(rad(28))
  const x = Math.sin(rad(28)) * Math.cos(rad(35))
  const z = Math.sin(rad(28)) * Math.sin(rad(35))
  return [x, y, z]
})()

// How much more likely a star is to sit near the plane than at the poles.
// The exponential in galactic latitude is what makes it a band rather than
// a smear.
const BAND_FLOOR = 0.22
const BAND_WIDTH = 0.16 // in sine of galactic latitude

const bandWeight = (sinLat) =>
  BAND_FLOOR + (1 - BAND_FLOOR) * Math.exp(-((sinLat / BAND_WIDTH) ** 2))

// A direction on the sphere, drawn towards the galactic plane.
function skyDirection(rand, concentrate) {
  for (let i = 0; i < 40; i++) {
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    const d = [
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
    ]
    const sinLat =
      d[0] * GALACTIC_POLE[0] + d[1] * GALACTIC_POLE[1] + d[2] * GALACTIC_POLE[2]
    const w = bandWeight(sinLat)
    if (rand() < Math.pow(w, concentrate)) return { d, sinLat, w }
  }
  return { d: [0, 0, 1], sinLat: 1, w: BAND_FLOOR }
}

export function starfield({ count = 2600, radius = 320, seed = 31 } = {}) {
  const rand = rng(seed)
  const sky = layer(count)
  for (let i = 0; i < count; i++) {
    const { d, sinLat } = skyDirection(rand, 1)
    // Nearer the plane means looking through more of the disc, so through
    // more young hot stars; out of the plane you are seeing the old halo.
    const s = star(rand, { floor: 3100, spread: 900, hot: (1 - Math.abs(sinLat)) * 2600 })
    put(sky, i, radius * d[0], radius * d[1], radius * d[2], s.col, s.size)
  }

  // And the band itself: the unresolved light of the disc seen edge on from
  // inside it, which is the most recognisable thing in a real night sky and
  // was simply missing. Large faint blobs, packed hard onto the plane.
  const bandCount = Math.round(count * 0.55)
  const band = layer(bandCount)
  for (let i = 0; i < bandCount; i++) {
    // 3.5, not 6: at 6 the band was knife-edged, with 87 per cent of it
    // inside six degrees of the plane and nothing at all past seventeen.
    // The real one has a bright core a few degrees wide and a glow that
    // carries out to twenty.
    const { d } = skyDirection(rand, 3.5)
    const c = blackbody(4300)
    put(band, i, radius * d[0], radius * d[1], radius * d[2], c, 6 + rand() * 14)
  }

  return { ...sky, band, radius, pole: GALACTIC_POLE }
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
