// Numbers for the hand of cards he holds out, found by trying them.
//
//   node scripts/offer-sweep.mjs
//
// Calls the real layout functions and mutates the real profile table, so
// what passes here is what ships. A sweep with its own copy of the fan
// formula is how the seven-card version came to report 21 pixels of
// clearance while the thing on the screen had ten pixels of overlap.
//
// It checks what the layout test checks — cards clear of the panel, the
// screen edges, his face and each other, his hands visible, all of it
// held through the whole of his breathing — and prints the arrangement
// with the most room to spare. Run it after adding a playlist, then paste
// the numbers into the profile for that count in layout.js.
import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import {
  PROFILES, offerCard, offerView, applyZoom, fitFor,
  placeNodes, placeBranches, figureFor, BODY_TOP, HEAD_Y, HEAD_R, PALM_X, labelWidth,
} from '../client/src/hub/layout.js'
import { posture } from '../client/src/hub/pose.js'

const content = new URL('../client/src/content/', import.meta.url)
const chapters = JSON.parse(readFileSync(new URL('chapters.json', content), 'utf8'))
const five = chapters.chapters || chapters
const music = five.find((c) => c.id === 'music')
const count = music.branches.length

const CLASSES = {
  phone: [[360, 780], [375, 812], [390, 844], [414, 896], [430, 932]],
  tablet: [[560, 900], [600, 800], [768, 1024], [790, 630], [820, 1180], [900, 600]],
  desktop: [[1024, 768], [1180, 700], [1280, 720], [1440, 820], [1512, 860], [1920, 1080]],
}
// His breathing and his knee bend. The cards are in his hands and ride
// with him, so every vertical margin is taken at both ends of it.
let high = 0
let low = 0
for (const groove of [0, 1]) {
  for (let i = 0; i < 400; i++) {
    const q = posture(i * 0.02, { open: 1, groove })
    high = Math.max(high, q.bodyY + q.dip)
    low = Math.min(low, q.bodyY + q.dip)
  }
}

// Every margin on one screen, in pixels. Negative is a failure.
function margins(w, h) {
  const narrow = w < 520
  const sheet = w <= 900
  const wall = sheet ? 0 : Math.min(430, w * 0.52)
  const free = sheet ? Math.round(h * 0.4) : h
  const safeTop = narrow ? 47 : 0

  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  applyZoom(offerView(narrow, sheet, count), fitFor(w), pos, look)
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
  cam.position.copy(pos)
  cam.lookAt(look)
  cam.updateMatrixWorld()
  const at = (v) => {
    const n = v.clone().project(cam)
    return { x: ((n.x + 1) / 2) * w, y: ((1 - n.y) / 2) * h }
  }

  const node = placeNodes(five, narrow)[five.indexOf(music)]
  const subs = placeBranches({ ...node, angle: 0 }, music.branches, narrow, true, sheet)
  if (subs.length !== count || subs.some((b) => !b.pos)) return null

  const fig = figureFor(narrow)
  const crown = at(new THREE.Vector3(0, BODY_TOP * fig, 0))
  const chin = at(new THREE.Vector3(0, (HEAD_Y - HEAD_R) * fig, 0))
  const ride = [low * fig, 0, high * fig]
  const card = offerCard(narrow, sheet, count)
  const base = at(new THREE.Vector3(0, 0, 0)).y

  const boxes = subs.map((b) => {
    const c = at(b.pos)
    const hw = Math.abs(at(new THREE.Vector3(b.pos.x + card.w / 2, b.pos.y, b.pos.z)).x - c.x)
    const hh = Math.abs(at(new THREE.Vector3(b.pos.x, b.pos.y + card.h / 2, b.pos.z)).y - c.y)
    return { l: c.x - hw, r: c.x + hw, t: c.y - hh, b: c.y + hh, id: b.id }
  })

  const m = [['crown', crown.y - safeTop]]
  for (const box of boxes) {
    m.push(['panel ' + box.id, box.l - wall])
    m.push(['right ' + box.id, w - box.r])
    m.push(['chin ' + box.id, box.t - chin.y])
    for (const dy of ride) {
      const shift = at(new THREE.Vector3(0, dy, 0)).y - base
      m.push(['top ' + box.id, shift + box.t - safeTop])
      m.push(['bottom ' + box.id, free - (shift + box.b)])
    }
  }
  // Eight pixels apart, in one direction or the other.
  //
  // The test only measures sideways, and only for two cards that share
  // some height — so two rows that merely fail to overlap satisfy it by
  // a hair. Asked for that, the search parked exactly on the line: rows
  // a third of a pixel apart, which rounding to three decimals turned
  // into a 77-pixel overlap. Taking the better of the two clearances
  // means a row either sits beside its neighbour or properly below it.
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const side = Math.max(a.l, b.l) - Math.min(a.r, b.r)
      const over = Math.max(a.t, b.t) - Math.min(a.b, b.b)
      m.push(['gap ' + a.id + '/' + b.id, Math.max(side, over) - 8])
    }
  }
  m.push(['card width', boxes[0].r - boxes[0].l - 66])

  // And the names, which were never measured. A label is capped at a
  // width the component applies, so what it comes to here is that cap
  // scaled by how big a world unit is on this screen. Two names must
  // not touch, the same eight pixels apart the cards keep.
  const pxPerWorld = Math.abs(
    at(new THREE.Vector3(1, 0, 0)).x - at(new THREE.Vector3(0, 0, 0)).x
  )
  const name = labelWidth(pxPerWorld)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a2 = boxes[i], b2 = boxes[j]
      const ca = (a2.l + a2.r) / 2, cb = (b2.l + b2.r) / 2
      // Names sit under their own card, so they only collide with a
      // neighbour on roughly the same line.
      if (Math.abs(a2.t - b2.t) > 12) continue
      m.push(['name ' + a2.id + '/' + b2.id, Math.abs(ca - cb) - name - 8])
    }
  }
  const hand = at(
    new THREE.Vector3(
      narrow ? PALM_X.narrow : PALM_X.wide,
      narrow ? 0.796 : 0.995,
      narrow ? 0.33 : 0.413
    )
  )
  m.push(['hand below', hand.y - Math.max(...boxes.map((b) => b.b))])
  m.push(['hand outside', hand.x - Math.max(...boxes.map((b) => b.r))])
  m.push(['hand onscreen', w - 6 - hand.x])
  return m
}

function score(cls) {
  let worst = Infinity
  let who = null
  for (const [w, h] of CLASSES[cls]) {
    const m = margins(w, h)
    if (!m) return { worst: -1e9, who: 'wrong number of cards' }
    for (const [name, v] of m) if (v < worst) { worst = v; who = w + 'x' + h + ' ' + name }
  }
  return { worst, who }
}

// The box each number is searched in. Wide enough to contain an answer,
// narrow enough that most of what is tried is worth trying.
//
// The camera is kept near where the six- and seven-card ones put it, on
// purpose. Left to itself the search climbs to a camera two metres up
// looking at his knees, because nothing here can see that it is an
// overhead shot of a man holding nine cards — it only knows the cards
// fit. Framing is not a thing to be optimised into.
const RANGE = {
  phone: { ar: [0.56, 0.62], span: [0.15, 0.33], lift: [0.12, 0.52], row: [0.07, 0.21], cw: [0.10, 0.22], py: [0.95, 1.55], pz: [2.0, 3.0], ly: [0.2, 0.6], drop: [0, 0.06], out: [0.10, 0.28] },
  tablet: { ar: [0.70, 0.78], span: [0.14, 0.38], lift: [0.10, 0.50], row: [0.07, 0.21], cw: [0.10, 0.25], py: [0.95, 1.9], pz: [2.15, 3.9], ly: [0.3, 0.9], drop: [0, 0.06], out: [0.10, 0.28] },
  desktop: { ar: [0.70, 0.78], span: [0.15, 0.42], lift: [0.12, 0.54], row: [0.07, 0.23], cw: [0.10, 0.27], py: [1.2, 2.1], pz: [1.9, 3.3], ly: [0.45, 1.0], drop: [0, 0.06], out: [0.10, 0.28] },
}

// --check reports what the numbers now in layout.js are worth, rather
// than looking for new ones. The first set this sweep produced passed
// here by five pixels and failed the layout test by sixty-seven, so
// being able to ask the question both ways matters.
if (process.argv.includes('--check')) {
  for (const cls of Object.keys(CLASSES)) {
    for (const [w, h] of CLASSES[cls]) {
      const m = margins(w, h)
      if (!m) { console.log(w + 'x' + h + ': wrong number of cards'); continue }
      const sorted = [...m].sort((a, b) => a[1] - b[1]).slice(0, 3)
      console.log(w + 'x' + h + ': ' + sorted.map(([n, v]) => n + ' ' + v.toFixed(1)).join(', '))
    }
  }
  process.exit(0)
}

const KEYS = ['span', 'lift', 'drop', 'row', 'out', 'cw', 'ar', 'py', 'pz', 'ly']
const rnd = (a, b) => a + Math.random() * (b - a)

function sample(R, from, k) {
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

const shown = (n, d = 3) => n.toFixed(d)

for (const cls of ['phone', 'tablet', 'desktop']) {
  const slot = PROFILES[9][cls]
  const lookX = slot.view.look[0]
  const keep = JSON.parse(JSON.stringify(slot))
  const R = RANGE[cls]
  const build = (p) => ({
    span: p.span, lift: p.lift, drop: p.drop, row: p.row, out: p.out,
    card: { w: p.cw, h: p.cw * p.ar },
    view: { pos: [0, p.py, p.pz], look: [lookX, p.ly, 0] },
  })
  const tryIt = (p) => {
    Object.assign(slot, build(p))
    return score(cls).worst
  }

  let best = null
  for (let i = 0; i < 150000; i++) {
    const p = sample(R, null, 1)
    const w = tryIt(p)
    if (!best || w > best.w) best = { w, p }
  }
  // Then walk downhill from the best start, with a shrinking step.
  for (let k = 0.3; k > 0.0005; k *= 0.7) {
    for (let i = 0; i < 8000; i++) {
      const p = sample(R, best.p, k)
      const w = tryIt(p)
      if (w > best.w) best = { w, p }
    }
  }

  Object.assign(slot, build(best.p))
  const final = score(cls)
  Object.assign(slot, keep)

  const p = best.p
  console.log('')
  console.log(cls + ': worst margin ' + final.worst.toFixed(1) + 'px  (' + final.who + ')')
  console.log('    span: ' + shown(p.span) + ', lift: ' + shown(p.lift) + ', drop: ' + shown(p.drop) +
    ', row: ' + shown(p.row) + ', out: ' + shown(p.out) + ',')
  console.log('    card: { w: ' + shown(p.cw) + ', h: ' + shown(p.cw * p.ar) + ' },')
  console.log('    view: { pos: [0, ' + shown(p.py, 2) + ', ' + shown(p.pz, 2) + '], look: [' +
    lookX + ', ' + shown(p.ly, 2) + ', 0] },')
}
