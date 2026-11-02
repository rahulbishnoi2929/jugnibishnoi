// Where the ring of playlists lands, on every screen.
//
//   node scripts/ring-check.mjs          what the numbers in layout.js give
//   node scripts/ring-check.mjs --find   look for better ones
//
// Calls the real layout functions, for the reason the fan's sweep did:
// a checker with its own copy of the geometry measures a layout that is
// not the one being drawn.
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import {
  ringAt, ringOf, ringView, applyZoom, fitFor, figureFor, BODY_TOP, HEAD_Y, HEAD_R,
} from '../client/src/hub/layout.js'

const content = new URL('../client/src/content/', import.meta.url)
const chapters = JSON.parse(readFileSync(new URL('chapters.json', content), 'utf8'))
const music = (chapters.chapters || chapters).find((c) => c.id === 'music')
const count = music.branches.length

const CLASSES = {
  phone: [[360, 780], [375, 812], [414, 896], [430, 932]],
  tablet: [[560, 900], [600, 800], [768, 1024], [790, 630], [900, 600]],
  desktop: [[1024, 768], [1280, 720], [1440, 820], [1920, 1080]],
}

function margins(w, h) {
  const narrow = w < 520
  const sheet = w <= 900
  const wall = sheet ? 0 : Math.min(430, w * 0.52)
  const free = sheet ? Math.round(h * 0.4) : h
  const safeTop = narrow ? 47 : 0

  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  applyZoom(ringView(narrow, sheet), fitFor(w), pos, look)
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
  cam.position.copy(pos)
  cam.lookAt(look)
  cam.updateMatrixWorld()
  const at = (v) => {
    const n = v.clone().project(cam)
    return { x: ((n.x + 1) / 2) * w, y: ((1 - n.y) / 2) * h }
  }

  const o = ringOf(narrow, sheet)
  const fig = figureFor(narrow)
  const chin = at(new THREE.Vector3(0, (HEAD_Y - HEAD_R) * fig, 0))
  const crown = at(new THREE.Vector3(0, BODY_TOP * fig, 0))

  // The card at the front, and the two beside it.
  const box = (i) => {
    const seat = ringAt(i, count, 0, o)
    const c = new THREE.Vector3(...seat.pos)
    // A card turned away is narrower on screen by exactly the cosine of
    // its angle, which is what makes the ring read as a ring.
    const half = (o.card.w / 2) * Math.cos(seat.angle)
    const mid = at(c)
    const edge = at(new THREE.Vector3(c.x + half, c.y, c.z))
    const top = at(new THREE.Vector3(c.x, c.y + o.card.h / 2, c.z))
    const hw = Math.abs(edge.x - mid.x)
    const hh = Math.abs(top.y - mid.y)
    return { l: mid.x - hw, r: mid.x + hw, t: mid.y - hh, b: mid.y + hh, show: seat.show }
  }

  const front = box(0)
  const side = box(1)
  const m = []
  m.push(['front width', front.r - front.l - 120])
  m.push(['front left of panel', front.l - wall - 8])
  m.push(['front right edge', w - front.r - 8])
  m.push(['front under the panel', free - front.b - 8])
  m.push(['front over his face', front.t - chin.y])
  m.push(['his head on screen', crown.y - safeTop])
  // The next one along has to be visible, or it is not a ring, it is a
  // card.
  m.push(['next one showing', side.r - wall - 8])
  m.push(['next one on screen', w - side.l - 8])
  // And they must not pile up on each other. Nine cards on a circle
  // barely wider than one of them is a stack, not a ring — the card at
  // the front ends up with its neighbours lying across it.
  const midFront = (front.l + front.r) / 2
  const midSide = (side.l + side.r) / 2
  m.push(['cards stacked', Math.abs(midSide - midFront) - (front.r - front.l) * 0.72])
  return m
}

function score(cls) {
  let worst = Infinity
  let who = null
  for (const [w, h] of CLASSES[cls]) {
    for (const [name, v] of margins(w, h)) if (v < worst) { worst = v; who = w + 'x' + h + ' ' + name }
  }
  return { worst, who }
}

if (!process.argv.includes('--find')) {
  for (const cls of Object.keys(CLASSES)) {
    for (const [w, h] of CLASSES[cls]) {
      const m = margins(w, h).sort((a, b) => a[1] - b[1]).slice(0, 3)
      console.log(w + 'x' + h + ': ' + m.map(([n, v]) => n + ' ' + v.toFixed(0)).join(', '))
    }
  }
  process.exit(0)
}

const RANGE = {
  phone: { radius: [0.34, 0.62], front: [0.4, 1.1], lift: [0.75, 1.35], cw: [0.26, 0.5], py: [0.8, 1.9], pz: [1.7, 3.4], ly: [0.5, 1.3] },
  tablet: { radius: [0.34, 0.66], front: [0.4, 1.1], lift: [0.75, 1.35], cw: [0.26, 0.55], py: [0.8, 2.0], pz: [1.9, 3.8], ly: [0.5, 1.3] },
  desktop: { radius: [0.34, 0.7], front: [0.4, 1.1], lift: [0.75, 1.4], cw: [0.26, 0.6], py: [0.9, 2.1], pz: [1.8, 3.6], ly: [0.5, 1.4] },
}
const KEYS = ['radius', 'front', 'lift', 'cw', 'py', 'pz', 'ly']
const rnd = (a, b) => a + Math.random() * (b - a)
const sample = (R, from, k) => {
  const p = {}
  for (const key of KEYS) {
    const [lo, hi] = R[key]
    if (!from) p[key] = rnd(lo, hi)
    else {
      const step = (hi - lo) * k
      p[key] = Math.min(hi, Math.max(lo, from[key] + rnd(-step, step)))
    }
  }
  return p
}

for (const cls of Object.keys(CLASSES)) {
  const live = cls === 'phone' ? ringOf(true, true) : cls === 'tablet' ? ringOf(false, true) : ringOf(false, false)
  const keep = JSON.parse(JSON.stringify(live))
  const lookX = live.view.look[0]
  const R = RANGE[cls]
  const build = (p) => {
    live.radius = p.radius
    live.front = p.front
    live.lift = p.lift
    live.card = { w: p.cw, h: p.cw * 0.5625 }
    live.view = { pos: [0, p.py, p.pz], look: [lookX, p.ly, 0] }
  }
  let best = null
  for (let i = 0; i < 90000; i++) {
    const p = sample(R, null, 1)
    build(p)
    const s = score(cls).worst
    if (!best || s > best.w) best = { w: s, p }
  }
  for (let k = 0.3; k > 0.0008; k *= 0.7) {
    for (let i = 0; i < 7000; i++) {
      const p = sample(R, best.p, k)
      build(p)
      const s = score(cls).worst
      if (s > best.w) best = { w: s, p }
    }
  }
  build(best.p)
  const final = score(cls)
  Object.assign(live, keep)
  const p = best.p
  console.log('')
  console.log(cls + ': worst ' + final.worst.toFixed(0) + 'px  (' + final.who + ')')
  console.log('    radius: ' + p.radius.toFixed(3) + ', front: ' + p.front.toFixed(3) + ', lift: ' + p.lift.toFixed(3) + ',')
  console.log('    card: { w: ' + p.cw.toFixed(3) + ', h: ' + (p.cw * 0.5625).toFixed(3) + ' },')
  console.log('    view: { pos: [0, ' + p.py.toFixed(2) + ', ' + p.pz.toFixed(2) + '], look: [' + lookX + ', ' + p.ly.toFixed(2) + ', 0] },')
}
