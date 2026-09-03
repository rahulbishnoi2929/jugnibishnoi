// Builds client/src/hub/india.json — India's outline, highlighted on the
// globe under the figure's feet.
//
// Usage:
//   curl -o india-composite.geojson \
//     https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson
//   node scripts/gen-india.js india-composite.geojson
//
// WHICH BOUNDARY THIS IS, AND WHY IT MATTERS
//
// India's boundaries are disputed, and datasets disagree. Natural Earth —
// which most web mapping defaults to, and which this project used first —
// draws the de-facto line and stops at about 35.5°N, leaving out
// Gilgit-Baltistan and Aksai Chin. That is not how India depicts itself,
// and maps published in India are required to show the official boundary.
//
// This uses Datameet's india-composite, which reaches 37.10°N and includes
// Jammu & Kashmir in full. It is the boundary as India claims it.
//
// The source is ~250k points and 10MB. Simplified here with
// Douglas-Peucker down to a few hundred, which is all a line 1.35 units
// across can show.
const fs = require('fs')
const path = require('path')

const geo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

// Every ring in the file, whatever nesting the geometry uses.
const rings = []
const walk = (c) => {
  if (!Array.isArray(c) || !c.length) return
  if (typeof c[0][0] === 'number') return rings.push(c)
  for (const x of c) walk(x)
}
for (const f of geo.features ?? [geo]) walk(f.geometry.coordinates)

// Perpendicular distance from p to the line a-b, in degrees.
const dist = (p, a, b) => {
  const [x, y] = p
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return Math.hypot(x - a[0], y - a[1])
  const t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)
  const c = t < 0 ? a : t > 1 ? b : [a[0] + t * dx, a[1] + t * dy]
  return Math.hypot(x - c[0], y - c[1])
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts
  let worst = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[0], pts[pts.length - 1])
    if (d > worst) {
      worst = d
      idx = i
    }
  }
  if (worst <= tol) return [pts[0], pts[pts.length - 1]]
  return [
    ...simplify(pts.slice(0, idx + 1), tol).slice(0, -1),
    ...simplify(pts.slice(idx), tol),
  ]
}

const span = (r) => {
  const lons = r.map((p) => p[0])
  const lats = r.map((p) => p[1])
  return Math.hypot(
    Math.max(...lons) - Math.min(...lons),
    Math.max(...lats) - Math.min(...lats)
  )
}

const round = (n) => Math.round(n * 100) / 100

// Keep the island territories — Andaman & Nicobar and the rest are Indian
// territory. Below about a quarter degree they are sub-pixel at this scale.
const kept = rings
  .filter((r) => span(r) > 0.25)
  .sort((a, b) => span(b) - span(a))
  .map((r) => simplify(r, 0.05).map(([lo, la]) => [round(lo), round(la)]))
  .filter((r) => r.length >= 3)

const all = kept.flat()
const out = path.join(__dirname, '..', 'client', 'src', 'hub', 'india.json')
fs.writeFileSync(
  out,
  JSON.stringify({
    _source:
      'Datameet india-composite (github.com/datameet/maps). India’s official boundary, including Jammu & Kashmir in full — northernmost point 37.1°N. Simplified with Douglas-Peucker. Regenerate with scripts/gen-india.js.',
    rings: kept,
  }) + '\n'
)

console.log(
  'rings kept:', kept.length,
  '| points:', all.length,
  '| lat max:', Math.max(...all.map((p) => p[1])).toFixed(2),
  '\n->', out
)
