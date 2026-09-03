// Builds client/src/hub/india-states.json — the state and union territory
// boundaries drawn in orange on the globe.
//
// Usage:
//   curl -Lo states.geojson \
//     https://raw.githubusercontent.com/datameet/maps/master/docs/data/geojson/states.geojson
//   node scripts/gen-states.js states.geojson
//
// Source: Datameet (github.com/datameet/maps). Same family as the national
// outline, so the two agree: 36 states and union territories, reaching
// 37.08°N, which means Ladakh and J&K in full.
//
// The source is 359,694 points across 36 features and 15.7MB. Simplified
// here to a few thousand, drawn as one LineSegments geometry so the whole
// set is a single draw call and stays vector-crisp when you zoom in.
const fs = require('fs')
const path = require('path')

const geo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

const rings = []
const walk = (c) => {
  if (!Array.isArray(c) || !c.length) return
  if (typeof c[0][0] === 'number') return rings.push(c)
  for (const x of c) walk(x)
}
for (const f of geo.features ?? [geo]) walk(f.geometry.coordinates)

const dist = (p, a, b) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
  const c = t < 0 ? a : t > 1 ? b : [a[0] + t * dx, a[1] + t * dy]
  return Math.hypot(p[0] - c[0], p[1] - c[1])
}

// Douglas-Peucker, iterative. Some state rings run to tens of thousands of
// points and the recursive form blows the stack.
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]

  while (stack.length) {
    const [lo, hi] = stack.pop()
    let worst = 0
    let idx = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = dist(pts[i], pts[lo], pts[hi])
      if (d > worst) {
        worst = d
        idx = i
      }
    }
    if (idx !== -1 && worst > tol) {
      keep[idx] = 1
      stack.push([lo, idx], [idx, hi])
    }
  }

  return pts.filter((_, i) => keep[i])
}

const span = (r) => {
  let x0 = 999, x1 = -999, y0 = 999, y1 = -999
  for (const [x, y] of r) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return Math.hypot(x1 - x0, y1 - y0)
}

const round = (n) => Math.round(n * 1000) / 1000

const kept = rings
  .filter((r) => span(r) > 0.2)
  .map((r) => simplify(r, 0.035).map(([lo, la]) => [round(lo), round(la)]))
  .filter((r) => r.length >= 3)

const total = kept.reduce((n, r) => n + r.length, 0)
const out = path.join(__dirname, '..', 'client', 'src', 'hub', 'india-states.json')
fs.writeFileSync(
  out,
  JSON.stringify({
    _source:
      'Datameet states.geojson (github.com/datameet/maps). 36 states and union territories, reaching 37.08°N — Ladakh and J&K in full, consistent with india.json. Douglas-Peucker simplified. Regenerate with scripts/gen-states.js.',
    rings: kept,
  }) + '\n'
)

console.log(
  'rings kept:', kept.length,
  'of', rings.length,
  '| points:', total,
  '(from', rings.reduce((n, r) => n + r.length, 0) + ')',
  '\n->', out
)
