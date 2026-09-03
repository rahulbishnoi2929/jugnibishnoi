// Builds client/public/textures/earth.svg — the globe texture: ocean,
// land, and every country boundary in white.
//
// Usage:
//   curl -o land.json      https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json
//   curl -o countries.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
//   node scripts/gen-earth.js land.json countries.json
//
// Borders are baked into the texture rather than drawn as 3D lines: ~170
// countries would be ~170 draw calls, and at this globe size the texture
// resolves them fine.
//
// INDIA IS DELIBERATELY EXCLUDED from the white borders. This dataset is
// Natural Earth, which draws India on the de-facto line; India's own
// boundary is drawn separately and officially, in wheat, from
// client/src/hub/india.json. Drawing both would contradict itself.
// Neighbouring borders are also clipped where they fall inside India's
// official territory — see `insideIndia` below.
const fs = require('fs')
const path = require('path')

const [, , landFile, countriesFile] = process.argv
if (!landFile || !countriesFile) {
  console.error('usage: node gen-earth.js land.json countries.json')
  process.exit(1)
}

// --- topojson -------------------------------------------------------------

function decode(topo) {
  const { scale, translate } = topo.transform
  return topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]]
    })
  })
}

const ringOf = (arcs, indices) => {
  const pts = []
  for (const i of indices) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]
    pts.push(...(pts.length ? a.slice(1) : a))
  }
  return pts
}

function ringsOf(topo, filter = () => true) {
  const arcs = decode(topo)
  const key = Object.keys(topo.objects)[0]
  const obj = topo.objects[key]
  const geoms = obj.type === 'GeometryCollection' ? obj.geometries : [obj]
  const out = []
  for (const g of geoms) {
    if (!filter(g)) continue
    const polys = g.type === 'MultiPolygon' ? g.arcs : [g.arcs]
    for (const poly of polys) for (const r of poly) out.push(ringOf(arcs, r))
  }
  return out
}

// --- geometry -------------------------------------------------------------

const r2 = (n) => Math.round(n * 100) / 100
const project = ([lon, lat]) => [r2(lon + 180), r2(90 - lat)]

// A ring crossing the antimeridian jumps >180° in longitude; drawn as-is
// it streaks across the whole map, so split it there.
function split(ring) {
  const pieces = [[]]
  for (let i = 0; i < ring.length; i++) {
    if (i && Math.abs(ring[i][0] - ring[i - 1][0]) > 180) pieces.push([])
    pieces[pieces.length - 1].push(ring[i])
  }
  return pieces.filter((p) => p.length > 1)
}

// India's official outline, so neighbours' borders can be kept out of it.
const indiaRing = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'hub', 'india.json'), 'utf8')
).rings[0]

function insideIndia([lon, lat]) {
  let hit = false
  for (let i = 0, j = indiaRing.length - 1; i < indiaRing.length; j = i++) {
    const [xi, yi] = indiaRing[i]
    const [xj, yj] = indiaRing[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      hit = !hit
    }
  }
  return hit
}

// --- land -----------------------------------------------------------------

const land = ringsOf(JSON.parse(fs.readFileSync(landFile, 'utf8')))
let landPath = ''
let landRings = 0
for (const ring of land) {
  for (const piece of split(ring)) {
    if (piece.length < 3) continue
    landRings++
    landPath += 'M' + piece.map((p) => project(p).join(' ')).join('L') + 'Z'
  }
}

// --- country borders ------------------------------------------------------

const countries = ringsOf(
  JSON.parse(fs.readFileSync(countriesFile, 'utf8')),
  (g) => g.id !== '356' // India — drawn officially, elsewhere
)

let borderPath = ''
let dropped = 0
let segments = 0
for (const ring of countries) {
  for (const piece of split(ring)) {
    // Break the polyline wherever a segment sits inside India, so no white
    // line runs through territory the wheat outline claims.
    let run = []
    const flush = () => {
      if (run.length > 1) {
        segments += run.length - 1
        borderPath += 'M' + run.map((p) => project(p).join(' ')).join('L')
      }
      run = []
    }
    for (let i = 0; i < piece.length; i++) {
      if (i) {
        const mid = [
          (piece[i][0] + piece[i - 1][0]) / 2,
          (piece[i][1] + piece[i - 1][1]) / 2,
        ]
        if (insideIndia(mid)) {
          dropped++
          flush()
          continue
        }
      }
      run.push(piece[i])
    }
    flush()
  }
}

// --- write ----------------------------------------------------------------

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 360 180" preserveAspectRatio="none">
  <!-- Land and borders: world-atlas 110m (Natural Earth, public domain).
       India excluded from the borders — drawn officially in wheat. -->
  <rect width="360" height="180" fill="#16323f"/>
  <path d="${landPath}" fill="#35543d" stroke="#5a7f63" stroke-width="0.3" stroke-linejoin="round"/>
  <path d="${borderPath}" fill="none" stroke="#eef4f2" stroke-width="0.22" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`

const out = path.join(__dirname, '..', 'client', 'public', 'textures', 'earth.svg')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, svg)

console.log(
  'land rings:', landRings,
  '| border segments:', segments,
  '| dropped inside India:', dropped,
  '\nbytes:', svg.length, '->', out
)
