// The three scales past his planet, as plain arrays of points.
//
// Pure functions with no React and no three.js scene objects, so they can
// be run and asserted under node — the frame loop is not observable in the
// pane this was built in, and a sky full of NaN would look exactly like a
// sky that had not loaded.
//
// Everything here is drawn in the site's own idiom: line work and points,
// no textures, no image assets. Nothing is to scale — the orbits are
// spread so you can tell them apart, not so they are right. It is the
// nesting that is honest, not the distances.

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

// Box-Muller, for clustering that falls off rather than stopping dead.
function gauss(rand) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const circle = (out, r, segments = 96) => {
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const b = ((i + 1) / segments) * Math.PI * 2
    out.push(Math.cos(a) * r, 0, Math.sin(a) * r)
    out.push(Math.cos(b) * r, 0, Math.sin(b) * r)
  }
}

// ---------- the solar system ----------

// name, orbit radius, dot radius, colour. Earth carries the Soil accent
// because that is the chapter his farm is in — the marker and the ground
// he stands on are the same yellow.
export const PLANETS = [
  ['Mercury', 0.9, 0.05, '#9c8f83'],
  ['Venus', 1.25, 0.085, '#c9a26b'],
  ['Earth', 1.62, 0.095, '#d4a72c'],
  ['Mars', 2.05, 0.065, '#b4553a'],
  ['Jupiter', 3.0, 0.22, '#c9a882'],
  ['Saturn', 3.8, 0.185, '#d6c08a'],
  ['Uranus', 4.6, 0.125, '#8fb8c4'],
  ['Neptune', 5.3, 0.12, '#5b8dbe'],
]

// Fixed angles rather than random ones, so they never line up in a row and
// never change under you.
const PHASE = [0.4, 2.1, 5.0, 3.3, 1.2, 4.4, 0.1, 2.8]

export const EARTH = PLANETS.findIndex(([n]) => n === 'Earth')

export function solarSystem() {
  const orbits = []
  for (const [, r] of PLANETS) circle(orbits, r)

  const planets = PLANETS.map(([name, r, size, color], i) => ({
    name,
    size,
    color,
    // On the far side of the ring from the sun's glare, mostly.
    pos: [Math.cos(PHASE[i]) * r, 0, Math.sin(PHASE[i]) * r],
    orbit: r,
  }))

  // Earth is the anchor: the stage gets offset so that this point is the
  // origin, which is where his planet already is. Without that he shrinks
  // into the middle of the solar system, which is the sun.
  return {
    orbits: new Float32Array(orbits),
    planets,
    anchor: planets[EARTH].pos,
  }
}

// ---------- the galaxy ----------

// A four-armed log spiral with a bulge. Positions and colours in one pass;
// the colour runs warm at the core to blue-white at the rim, which is both
// roughly true and the site's two accents at their extremes.
export function galaxy({ count = 14000, arms = 4, radius = 22, seed = 7 } = {}) {
  const rand = rng(seed)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)

  const core = [0.86, 0.71, 0.35] // wheat
  const rim = [0.6, 0.72, 0.9] // cold blue

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
      const spread = 0.5 * (1 - f * 0.6)
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

  // The sun is the anchor here, the way Earth is one stage in.
  const sun = SUN_AT(radius)
  return { pos, col, radius, sun, anchor: sun }
}

// Where the sun sits in it — two thirds out, in the Orion spur. Marking it
// is the point of the whole stage.
const SUN_AT = (radius) => {
  const r = radius * 0.62
  const theta = 0.62 + (r / radius) * 3.4
  return [Math.cos(theta) * r, 0, Math.sin(theta) * r]
}

// ---------- the observable universe ----------

// Galaxies are not scattered evenly, they hang in a web, so this places
// clusters first and then hangs members off them, plus faint filaments
// between neighbouring clusters. Without the clustering it reads as
// television static.
export function universe({
  clusters = 90,
  perCluster = 14,
  field = 260,
  radius = 70,
  seed = 19,
} = {}) {
  const rand = rng(seed)

  const centres = []
  for (let i = 0; i < clusters; i++) {
    // Uniform through the volume of a ball, not just its radius.
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
    // A little colour variation so it does not read as one flat grey.
    col[n * 3] = 0.72 + warmth * 0.26
    col[n * 3 + 1] = 0.74 + warmth * 0.1
    col[n * 3 + 2] = 0.82 - warmth * 0.12
    n++
  }

  for (const [cx, cy, cz] of centres) {
    const spread = radius * (0.03 + rand() * 0.05)
    for (let i = 0; i < perCluster; i++) {
      put(
        cx + gauss(rand) * spread,
        cy + gauss(rand) * spread,
        cz + gauss(rand) * spread,
        rand()
      )
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
    const d = centres
      .map((c, j) => ({ j, d2: dist2(centres[i], c) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, 2)
    for (const { j } of d) {
      web.push(...centres[i], ...centres[j])
    }
  }

  // One cluster stands in for ours, and anchors the stage.
  return {
    pos,
    col,
    web: new Float32Array(web),
    radius,
    home: centres[0],
    anchor: centres[0],
  }
}

const dist2 = (a, b) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

// What each stage calls itself on the way out.
export const CAPTIONS = {
  solar: ['The Solar System', 'he is on the third one'],
  galaxy: ['The Milky Way', 'the sun is one of a hundred billion'],
  universe: ['The Observable Universe', 'every point here is a galaxy'],
}
