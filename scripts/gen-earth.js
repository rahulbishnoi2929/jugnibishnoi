// Builds client/public/textures/earth.svg — an equirectangular world map
// used as the globe texture.
//
// Source: world-atlas land-110m (TopoJSON), derived from Natural Earth,
// which is public domain. Decoded here rather than shipping a topojson
// runtime dependency.
const fs = require('fs')
const path = require('path')

const topo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const { scale, translate } = topo.transform

// TopoJSON arcs are quantised and delta-encoded.
const arcs = topo.arcs.map((arc) => {
  let x = 0
  let y = 0
  return arc.map(([dx, dy]) => {
    x += dx
    y += dy
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]]
  })
})

// A negative index means that arc, reversed, and skips its first point.
const ring = (indices) => {
  const pts = []
  for (const i of indices) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]
    pts.push(...(pts.length ? a.slice(1) : a))
  }
  return pts
}

const r = (n) => Math.round(n * 100) / 100

// lon,lat -> equirectangular, x 0..360 (lon -180 at left), y 0..180 (north up)
const project = ([lon, lat]) => [r(lon + 180), r(90 - lat)]

// land is a GeometryCollection of Polygon and MultiPolygon geometries.
const land = topo.objects.land
const geoms = land.type === 'GeometryCollection' ? land.geometries : [land]

let d = ''
let rings = 0
for (const g of geoms) {
  const polys = g.type === 'MultiPolygon' ? g.arcs : [g.arcs]
  for (const poly of polys) {
    for (const r0 of poly) {
      const lonlat = ring(r0)
      if (lonlat.length < 3) continue

      // A ring that crosses the antimeridian has a >180° jump in
      // longitude, and drawn naively it streaks straight across the whole
      // map. Split it there into separate closed pieces instead.
      const pieces = [[]]
      for (let i = 0; i < lonlat.length; i++) {
        if (i && Math.abs(lonlat[i][0] - lonlat[i - 1][0]) > 180) pieces.push([])
        pieces[pieces.length - 1].push(project(lonlat[i]))
      }

      for (const piece of pieces) {
        if (piece.length < 3) continue
        rings++
        d += 'M' + piece.map((p) => p.join(' ')).join('L') + 'Z'
      }
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 360 180" preserveAspectRatio="none">
  <!-- Land from world-atlas land-110m (Natural Earth, public domain). -->
  <rect width="360" height="180" fill="#16323f"/>
  <path d="${d}" fill="#35543d" stroke="#5a7f63" stroke-width="0.35" stroke-linejoin="round"/>
</svg>
`

const out = 'C:/Users/rahul/Projects/portfolio/client/public/textures/earth.svg'
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, svg)
console.log('rings:', rings, '| bytes:', svg.length, '->', out)
