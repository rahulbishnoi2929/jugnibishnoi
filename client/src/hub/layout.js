import * as THREE from 'three'

// How high his head sits, and how big it is. Both live here rather than in
// Figure.jsx so this module stays plain geometry with no React in its
// import graph — that is what lets layout.test.mjs run it under node.
// Figure imports them back.
//
// He is 1.95 tall and his head is 0.26, which is 7.5 heads. That is the
// proportion of an adult; he was 5.7 before, which is why he read a little
// like a toy.
export const HEAD_R = 0.13
export const HEAD_Y = 1.82
export const BODY_TOP = HEAD_Y + HEAD_R

// How big he is drawn, for a given viewport.
//
// The ring shrank for phones and he did not, which left him standing a head
// taller than his own branches: the chapter ring sat 0.48 *below* the top
// of his head, so every branch grew downwards out of it. On a desktop the
// same ring is 0.32 above. That is the droop.
//
// 0.64 puts the ring back above his head by the same fraction of its own
// radius that the desktop one is, so the whole thing is the same shape at
// both sizes. Scaling him rather than moving the rings is what keeps the
// ring's width, its openness, and every label position exactly as measured.
// The camera sits at 2.4 and cannot go much higher without looking down on
// the top of everything, so how steeply a branch rises out of his head is
// mostly a question of how far below the ring his head is. Shrinking him is
// the lever that has: at full size on a desktop his head was 1.97 against a
// ring at 2.25, and the branches came out five degrees off flat.
export const figureFor = (narrow) => (narrow ? 0.64 : 0.8)

// The crown, not the centre of the skull — 0.06 put the junction inside
// his head, so the branches read as passing through his face.
// Just above the crown, not the centre of the skull: a junction inside his
// head reads as branches passing through his face.
export const headFor = (narrow) =>
  new THREE.Vector3(0, (BODY_TOP + 0.02) * figureFor(narrow), 0)

// Two rings around him, each split evenly through a full circle.
//
// They used to fan across the front with the depth squashed to 0.42, which
// meant turning the constellation only slid the same flat spread sideways —
// nothing ever came round from behind. Full circle, full depth.
const ring = (items, { r, y, phase }) =>
  items.map((item, i) => {
    const a = phase + (i * Math.PI * 2) / items.length
    return {
      ...item,
      angle: a,
      pos: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r),
    }
  })

// How far back the camera sits for a given viewport width.
//
// A phone cannot take the desktop framing, but pulling back 2.5x to make
// the ring fit left everything too small to read. The ring shrinks instead
// and the pull-back is gentle.
export const fitFor = (w) => (w < 520 ? 1.35 : w < 760 ? 1.15 : 1)

// On a desktop the rooms hang below him and it reads fine: the ring is
// 2.5 wide against a body a fifth of a unit across, so the branches swing
// well clear.
//
// A phone cannot do that. Everything is half the size but the labels are
// still typed at 16px, and a branch running from his head down to a ring
// beside his knees crosses his body — measured over a full turn, 608 curve
// points landed on his silhouette. So on a phone both rings go above his
// head: the chapters on top, the rooms tucked between them and his crown.
// That takes the crossings to zero, and it makes the whole composition 407
// pixels tall instead of 344, which the empty top of the screen wanted
// anyway.
//
// The 0.80 between the two rings is measured, not chosen. At 0.63 the two
// sets of labels still overlapped by 59 pixels; at 0.80 they clear.
// Both rings sit above his head on both screens now, and by enough to
// read as rising rather than lying flat.
//
// The number that matters is the angle a branch leaves his head at, and it
// was bad: on a desktop the chapters rose 5 degrees and the rooms fell 19,
// which is a starburst drooping towards the ground rather than branches. On
// a phone the chapters were fine at 32 and the rooms flat at 9. Measured
// after: 19 and 15 on a desktop, 34 and 20 on a phone.
//
// Raising a ring is only half of it. The other half is how far his head is
// below it, which is why the figure scale moved too — see figureFor.
const RING = {
  wide: { chapters: { r: 3.0, y: 2.6 }, rooms: { r: 2.2, y: 2.15 } },
  // 1.70, not 1.55: a sixth chapter arrived and Build and Signal started
  // overlapping by 5 pixels on a phone. Widening the ring is what fixes
  // that — re-phasing the rooms would not, because the collision is
  // chapter against chapter. Measured over a full turn, 1.70 is clear and
  // 1.85 starts running labels off the right edge.
  narrow: { chapters: { r: 1.7, y: 2.32 }, rooms: { r: 1.02, y: 1.63 } },
}


// Chapters ride high and wide, in order, so spinning walks the years.
export function placeNodes(chapters, narrow) {
  const { r, y } = (narrow ? RING.narrow : RING.wide).chapters
  return ring(chapters, { r, y, phase: 0 })
}

// Rooms sit lower and tighter, offset half a step so one never hides
// directly behind a chapter.
export function placeRooms(rooms, narrow) {
  const { r, y } = (narrow ? RING.narrow : RING.wide).rooms
  return ring(rooms, { r, y, phase: Math.PI / 5 }).map((n) => ({
    ...n,
    ring: 'room',
  }))
}

// How big a branch's photograph is drawn, in world units.
//
// Different per viewport, and it has to be: the branches sit at z +3 on a
// desktop while the camera aims at a point 6.7 away, so they are barely
// three units from the lens and a rectangle drawn at one size comes out
// enormous. Measured at 0.78 wide it was 307 pixels across on a desktop
// against 105 on a phone — three times the size on the screen with more
// room, overlapping its neighbours by 51 pixels and covering him.
//
// These are chosen from the measurement instead: about 78 pixels on a
// phone, where four have to fit across 375, and about 172 on a desktop
// now that the row hangs over his head and has the full width of the
// strip beside the reading panel.
// Different per viewport, and it has to be: the branches sit at z +3 on a
// desktop while the camera aims at a point 6.7 away, so they are barely
// three units from the lens and a rectangle drawn at one size comes out
// enormous.
//
// And different per count, for the same reason the fan is. Six cards is
// not four cards spread wider — on a phone the band between the status
// bar and the top of his head is 116 pixels, which is two rows of 49 and
// nothing more. These are the largest that fit, measured: 64x49 on a
// phone in two rows of three, 113x109 on a desktop in one row of six.
export const cardFor = (narrow, count = 4) =>
  count > 4
    ? narrow
      ? { w: 0.46, h: 0.341 }
      : { w: 0.34, h: 0.252 }
    : narrow
      ? { w: 0.58, h: 0.43 }
      : { w: 0.52, h: 0.386 }

// The curve a branch takes from his head out to its node.
//
// A straight spoke looks like a diagram, so it bows. Both offsets are
// fractions of the branch's own length, which is what makes a branch bow by
// the same proportion of itself at any size — measured, about a sixth of
// its own length away from the straight line between its ends, which is 24
// pixels on a phone and 60 on a desktop.
//
// A flat number is what this used to be, and it cannot work: 0.35 was tuned
// for a desktop branch three units long, and on a phone — where the run
// from his head to the rooms ring was half a unit — it arched the curve up
// over his head and sent it out sideways across his face.
//
// It lives here, and both Nodes and the tests call it, so that what is
// measured is the curve that is actually drawn.
// How one branch drifts: its own rate, its own reach, its own place in
// the cycle.
//
// Every branch used to share a single rate and sit a fixed step apart in
// it. That is not nine things moving — it is one wave with nine points
// on it, and the whole ring reads as breathing in time. What separates
// them is the rate: no two the same, so any pair drifts apart and never
// lines up again, instead of holding the same distance forever. A first
// attempt at this repeated its rates every fifth branch, which left four
// pairs locked to each other exactly as before.
//
// The phase step is the golden angle, so wherever they start they start
// about as far apart as a given number of them can.
export const branchDrift = (index) => ({
  rate: 0.24 + index * 0.058,
  reach: 0.04 + ((index * 5) % 7) * 0.0065,
  phase: index * 2.39996,
  // The size wobble gets a rate of its own rather than a multiple of the
  // first, so a branch is never at its highest and its biggest together.
  wobbleRate: 1.07 + index * 0.097,
})

export function branchCurve(head, node, segments = 40) {
  const mid = head.clone().lerp(node, 0.5)
  const reach = head.distanceTo(node)
  mid.y += 0.2 * reach
  // Pushed outward from the spine, not sideways in x, or the branches on
  // the left and right of the ring bow the wrong way.
  mid.x *= 1.45
  mid.z *= 1.45
  return new THREE.QuadraticBezierCurve3(head, mid, node).getPoints(segments)
}

// A chapter's own branches, fanned out from its node. They open to the
// right because the reading panel owns the left half of the screen.
//
// Offsets are from the node, in world space — the ring is frozen at a
// known angle while a chapter is open, so this needs no extra maths.
// Down and to the right of the node: above it is off the top of the frame,
// and left of it is under the reading panel.
// Down and to the right on a desktop, where the reading panel is a column
// down the left and the figure sits in the right half.
//
// A phone is not that. There the panel is a bottom sheet over 60% of the
// screen, which leaves a band 375 by 325 above it — so the branches go in a
// row across that band instead. Measured before this existed, every one of
// the four sat at x 410 to 465 on a 375-wide screen and below y 344 on a
// band that ends at 227: the whole fan was off the side and under the
// panel at once, and you could open Campus on a phone and see none of it.
//
// The row is spaced 0.69 apart, which is 86 pixels there — enough for a
// photo rectangle between each with a gap.
// Where a chapter's branches sit, keyed by how many there are.
//
// It used to be one table per viewport, because only Campus had branches
// and Campus has four. Music has six playlists, and six is not four
// spread wider — measured, six photo-cards on a phone only fit by
// shrinking to 52 pixels across, which is a thumbnail you cannot read,
// and six names in one row need 420 pixels of a 375-pixel screen however
// evenly they are spaced.
//
// So six is a different shape, not a wider one: one row on a desktop,
// where there is 896 pixels of strip to use, and two rows of three on a
// phone, where there is not.
const FAN = {
  wide: {
    // Four: the Campus row. An arc rather than a column — measured, the
    // old one left the node at -32, -56, -66 and -75 degrees, four
    // photographs on a rope. A branch leaves its trunk rising, levels off
    // and then dips under its own weight, which is what these do now.
    //
    // Shifted 0.1 to his left, which is parallax and not taste: the node
    // is three units nearer the lens than he is, so a rectangle at world
    // x 0 projects 39 pixels right of a man at world x 0.
    4: [
      [-1.05, -0.346, 0],
      [-0.417, -0.115, 0],
      [0.217, -0.115, 0],
      [0.85, -0.346, 0],
    ],
    // Six: one row of cards, rising 14 degrees out of the node. 113
    // pixels across with 25 between them, which is the largest that keeps
    // the outermost clear of the right-hand edge.
    6: [
      [-1.05, -0.2618, 0],
      [-0.63, -0.1571, 0],
      [-0.21, -0.0524, 0],
      [0.21, -0.0524, 0],
      [0.63, -0.1571, 0],
      [1.05, -0.2618, 0],
    ],
  },
  narrow: {
    // Four: all leave at the same angle. A flat row cannot do that — the
    // ones nearest the middle have less width to fall across, so they
    // hung at -44 while the outer two sat at -22.
    4: [
      [-1.04, -0.379, 0],
      [-0.35, -0.127, 0],
      [0.35, -0.127, 0],
      [1.04, -0.379, 0],
    ],
    // Six: two rows of three. The band between a phone's status bar and
    // the top of his head is 116 pixels, and two rows of 49-pixel cards
    // with a gap is 109 of it — so the top edge lands at 50 against a
    // status bar ending at 47, and the bottom at 159 against a crown at
    // 163. There is four pixels of slack in the whole arrangement, which
    // is why every one of these numbers came off a sweep.
    6: [
      [-0.7, -0.075, 0],
      [0, -0.04, 0],
      [0.7, -0.075, 0],
      [-0.7, -0.475, 0],
      [0, -0.44, 0],
      [0.7, -0.475, 0],
    ],
  },
}

// Which branch counts there are positions for, on a given viewport.
export const fanCounts = (narrow) =>
  Object.keys(narrow ? FAN.narrow : FAN.wide).map(Number)

export const FAN_SLOTS = FAN.wide.length

export function placeBranches(node, branches = [], narrow, offered = false, sheet = false) {
  // The offsets are what we want to see on screen, but these nodes live
  // inside the turntable, which is counter-rotated by the node's own angle
  // while its chapter is open. Pre-rotating by that angle cancels it out —
  // without this the fan swung round and opened behind the panel.
  const spin = node.angle ?? 0

  // Music's branches are the offer, not a fan off the node. They are
  // already in world coordinates relative to him, so the node's position
  // is not added — only the turntable's rotation is cancelled, the same
  // way it is for everything else here.
  if (offered) {
    const places = offerFan(narrow, sheet, branches.length)
    return branches.map((b, i) => {
      const [dx, dy, dz] = places[i]
      const pos = new THREE.Vector3(dx, dy, dz).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        spin
      )
      return { ...b, parent: node.pos, pos, offered: true }
    })
  }

  const table = narrow ? FAN.narrow : FAN.wide
  const fan = table[branches.length]
  // No wrap and no nearest-fit. A table keyed by count means a chapter
  // with a count nobody has laid out is a question for whoever adds it,
  // not something to be approximated on screen — this used to index four
  // positions with i % 4, so a fifth branch landed exactly on the first.
  // A test over chapters.json holds every chapter to a count that exists.
  if (!fan) return []

  return branches.map((b, i) => {
    const [dx, dy, dz] = fan[i]
    const offset = new THREE.Vector3(dx, dy, dz).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      spin
    )
    return { ...b, parent: node.pos, pos: node.pos.clone().add(offset) }
  })
}


// ---------- Music: he holds the playlists out ----------
//
// Music does not use the branch fan. The others hang their branches off
// the chapter node on the ring; here he puts his hands out and the cards
// sit on his palms, so they are placed against the figure rather than
// against the ring, and nothing is drawn connecting them.
//
// Where his palms land is not a guess. The arm pivots at the shoulder and
// the hand is a fixed distance down it, so with the arm at OFFER_ARM and
// spread by OFFER_OUT the hand arrives at these, in world units after his
// own scale. Figure.jsx owns those two angles; if they move, so does this.
const PALM = {
  wide: { y: 0.995, z: 0.413 },
  narrow: { y: 0.796, z: 0.33 },
}
// How far out each hand reaches, which is what the cards have to stay
// inside of for the gesture to be visible at all.
export const PALM_X = { wide: 0.54, narrow: 0.432 }

// How wide a branch's name is allowed to be, and how to work out what
// that means on a screen.
//
// The names were never measured. The layout test checks that the cards
// clear each other and says nothing about the words under them, so at
// seven playlists "Personal Favourites" lay 82 pixels across "High
// Intensity" and everything still passed. A label is drawn by drei's
// Html at a fixed distanceFactor, which means — like the cards, and for
// the same reason — its size on screen is its CSS size divided by how
// far away it is. So one constant converts between them, measured off
// the running page: a world unit is this many CSS pixels inside one of
// those labels.
export const LABEL_PX_PER_WORLD = 271.3

// The widest a name may be, in its own CSS pixels. Applied to the label
// itself so the stylesheet and the sweep cannot drift apart.
export const LABEL_MAX_CSS = 46

// What that comes to on a screen, given how big a world unit is there.
export const labelWidth = (pxPerWorld) =>
  (LABEL_MAX_CSS * pxPerWorld) / LABEL_PX_PER_WORLD

// Six cards above the palms, in two rows of three on every screen.
//
// One arrangement, not three. Six across was tried and only fits a wide
// desktop: at 800 pixels the reading panel takes 52 per cent of the width
// and the row ran off the right-hand edge. Two rows of three survives 360
// pixels and 1920 alike, which is what the branch fan had to do too.
//
// Three profiles, because two breakpoints cross here and they are not the
// same one. He is drawn smaller below 520; the reading panel stops being
// a column down the left and becomes a sheet across the bottom below 900.
// The band between those is a full-size figure with a sheet, which is its
// own composition — and the one that broke when this had only two cases.
//
// Every number swept over ten viewports, against five things that are
// easy to lose: the cards clear of the panel and the screen edges, clear
// of his face, clear of each other, his hands visible — below the cards,
// outside them, still on the screen — and all of it held through the
// whole of his breathing and his knee bend, because the cards are in his
// hands and ride with him. That last one was added after a card was found
// reaching 28 pixels under the reading panel on a 560-wide tablet at the
// bottom of a breath, while the test said everything was fine.
const OFFER = {
  phone: {
    span: 0.22, lift: 0.32, drop: 0.03, row: 0.17, out: 0.18,
    card: { w: 0.19, h: 0.141 },
    view: { pos: [0, 1.3, 2.2], look: [0, 0.3, 0] },
  },
  tablet: {
    span: 0.22, lift: 0.28, drop: 0.03, row: 0.15, out: 0.18,
    card: { w: 0.19, h: 0.141 },
    view: { pos: [0, 1.4, 3.2], look: [0, 0.54, 0] },
  },
  desktop: {
    span: 0.26, lift: 0.32, drop: 0.03, row: 0.17, out: 0.18,
    card: { w: 0.22, h: 0.163 },
    // Aimed left only here, because only here is there a column of panel
    // to make room for. On a sheet it looks straight at him.
    view: { pos: [0, 1.7, 2.6], look: [-0.55, 0.7, 0] },
  },
}


// Seven of them is a different arrangement and a different camera, not
// the six-card one with an extra card dropped in. Four across then three,
// swept over the same ten viewports.
const SEVEN = {
  phone: {
    span: 0.3, lift: 0.3, drop: 0.03, row: 0.16, out: 0.18,
    card: { w: 0.16, h: 0.119 },
    view: { pos: [0, 1.1, 2.2], look: [0, 0.4, 0] },
  },
  tablet: {
    span: 0.34, lift: 0.26, drop: 0.03, row: 0.16, out: 0.18,
    card: { w: 0.18, h: 0.134 },
    view: { pos: [0, 1.2, 3.2], look: [0, 0.54, 0] },
  },
  desktop: {
    span: 0.34, lift: 0.3, drop: 0.03, row: 0.19, out: 0.18,
    card: { w: 0.2, h: 0.148 },
    view: { pos: [0, 1.5, 2.6], look: [-0.55, 0.7, 0] },
  },
}

// Nine, which is two arrangements and two card shapes — see offerFan
// for why. The wide screens get five then four, 4:3, with the name
// under each the way six and seven have it. A phone gets three rows of
// three, 16:9, with the names on the art: five across will not go at a
// size worth tapping, and a third row only fits if the card is short.
//
// Found by scripts/offer-sweep.mjs, which tries numbers against the
// checks the layout test makes and a stricter rule about cards keeping
// away from each other. Five pixels spare on a 360 phone, nine on a
// tablet. A tenth playlist will not go in this — run the sweep and it
// will say so rather than leave you to find out on a phone.
const NINE = {
  phone: {
    span: 0.247, lift: 0.401, drop: 0.003, row: 0.13, out: 0.137,
    card: { w: 0.164, h: 0.092 },
    view: { pos: [0, 1.55, 2.05], look: [0, 0.22, 0] },
  },
  tablet: {
    span: 0.368, lift: 0.397, drop: 0.004, row: 0.146, out: 0.22,
    card: { w: 0.159, h: 0.118 },
    view: { pos: [0, 1.78, 2.56], look: [0, 0.6, 0] },
  },
  desktop: {
    span: 0.373, lift: 0.301, drop: 0.001, row: 0.185, out: 0.15,
    card: { w: 0.154, h: 0.109 },
    view: { pos: [0, 1.67, 2.53], look: [-0.55, 0.7, 0] },
  },
}


// Keyed by how many he is holding, so a sweep can try numbers against
// the real layout rather than against a copy of it that has drifted.
export const PROFILES = { 6: OFFER, 7: SEVEN, 9: NINE }

const profile = (narrow, sheet, count = 6) => {
  const row = count > 8 ? PROFILES[9] : count > 6 ? PROFILES[7] : PROFILES[6]
  return narrow ? row.phone : sheet ? row.tablet : row.desktop
}

export function offerFan(narrow, sheet, count = 6) {
  const palm = narrow ? PALM.narrow : PALM.wide
  const o = profile(narrow, sheet, count)
  const z = palm.z + o.out
  const at = (x, extra = 0) => [
    x,
    palm.y + o.lift - Math.abs(x) * o.drop - extra,
    z,
  ]
  // Six is three and three; seven is four and three, with the lower row
  // tucked inside the upper one so the stack reads as a hand of cards
  // rather than a grid. Both swept over ten viewports.
  // Nine is two arrangements, because a phone and a desktop disagree
  // about what is scarce. Across the wide screens it is five then four,
  // which keeps the cards the shape the other counts use and leaves a
  // gap under each for its name. On a phone five across cannot be done
  // — the narrowest here is 360 wide, a card has to stay 66 across to
  // be worth tapping, and five of those with gaps comes to 366 before
  // the edges — so it is three rows of three, with the names on the art
  // the way a phone already does them.
  if (count > 8) {
    if (narrow) {
      const xs = [-o.span, 0, o.span]
      return [
        ...xs.map((x) => at(x)),
        ...xs.map((x) => at(x, o.row)),
        ...xs.map((x) => at(x, o.row * 2)),
      ]
    }
    const top = [-1, -0.5, 0, 0.5, 1].map((u) => u * o.span)
    const bottom = [-0.75, -0.25, 0.25, 0.75].map((u) => u * o.span)
    return [...top.map((x) => at(x)), ...bottom.map((x) => at(x, o.row))]
  }
  if (count > 6) {
    const top = [-1, -1 / 3, 1 / 3, 1].map((u) => u * o.span)
    const bottom = [-0.66, 0, 0.66].map((u) => u * o.span)
    return [...top.map((x) => at(x)), ...bottom.map((x) => at(x, o.row))]
  }
  const xs = [-o.span, 0, o.span]
  return [...xs.map((x) => at(x)), ...xs.map((x) => at(x, o.row))]
}

// Between 80 and 164 pixels across depending on the screen, which is the
// camera doing the work rather than three card sizes.
export const offerCard = (narrow, sheet, count = 6) => profile(narrow, sheet, count).card

export function offerView(narrow, sheet, count = 6) {
  const { view } = profile(narrow, sheet, count)
  return {
    pos: new THREE.Vector3(...view.pos),
    look: new THREE.Vector3(...view.look),
  }
}

// Where the camera sits when nothing is selected.
//
// The aim is low because the composition runs from the bottom of the globe
// (y = -2r, below his feet) to the top of the ring — its middle is near the
// ground, not near his chest. Aiming at 0.95 put that middle a screen-third
// below centre: everything piled up at the bottom edge with a band of empty
// sky above it. At 0.2 the content centres on both a phone and a desktop.
export const HOME_VIEW = {
  pos: new THREE.Vector3(0, 2.4, 9.4),
  look: new THREE.Vector3(0, 0.2, 0),
}

const CHEST = new THREE.Vector3(0, 1.2, 0)
const UP = new THREE.Vector3(0, 1, 0)

// Zooming pulls towards the ground at his feet, not towards his chest —
// the point of zooming here is to get close to the planet.
export const ZOOM_TARGET = new THREE.Vector3(0, -0.1, 0)
export const ZOOM_MIN = 0.4

// ---------- the way out ----------
//
// Zooming out does not stop at his little planet. Past it the view steps
// through nested scales — the solar system, the galaxy, the observable
// universe — each one the small bright thing at the middle of the next.
//
// Real distances span thirty orders of magnitude and no single scene
// survives that in float32. So each stage is modelled at a comfortable
// local size and nested by NEST: a stage is NEST times the size of the one
// outside it, and the ladder position decides which two you can see. That
// is the whole trick, and it is why none of these numbers are in metres.
export const ZOOM_HUB_MAX = 2.2 // the camera stops pulling back here
export const STAGES = ['solar', 'galaxy', 'universe']
const STAGE_STEP = 3.2 // zoom factor from one stage to the next
const NEST = 0.06 // a stage is this fraction of the size of the next one out

export const ZOOM_MAX = ZOOM_HUB_MAX * Math.pow(STAGE_STEP, STAGES.length)

// Where a zoom lands on the ladder: 0 the hub, 1 the solar system, 2 the
// galaxy, 3 the universe. Flat at 0 for the whole of the hub's own range,
// so nothing about zooming in changes.
export const cosmicScale = (zoom) =>
  Math.log(Math.max(zoom, ZOOM_HUB_MAX) / ZOOM_HUB_MAX) / Math.log(STAGE_STEP)

// How much of the frame a stage should fill when it is the subject: a bit
// inside the short edge, so nothing important sits on the border.
export const FRAME_FILL = 0.82

// The radius, in world units, that a stage should be scaled to occupy.
// Taken from the live camera rather than a table, so it is right on any
// viewport and cannot drift from the framing.
export function fitRadius(camera, distance) {
  const halfH = distance * Math.tan((camera.fov * Math.PI) / 360)
  return Math.min(halfH, halfH * camera.aspect) * FRAME_FILL
}

// How a stage should be drawn when the ladder is at t.
//
// `size` is its apparent radius as a fraction of the frame — 1 means it
// exactly fills the fit, 0.06 means it is a dot at the middle of whatever
// contains it. Because every stage is scaled by fitRadius / its own radius,
// this one number describes all of them, which is the point: the opacity
// below is written in terms of apparent size rather than ladder position.
//
// It has to be. The first version faded on ladder position while the three
// stages had local radii of 5.3, 22 and 70, so each peaked at a different
// and always wrong size — the solar system reached full opacity at nearly
// four times the frame, the galaxy at thirteen times, the universe at
// thirty-eight. You never actually saw any of them.
// SEEN is deliberately bigger than the frame. A stage first appears while
// you are still inside it, which is what pulling away from something looks
// like, and it closes the gap that 1.6 left: from the hub to the solar
// system there were four fifths of a ladder step with nothing on screen at
// all. At 2.8 the visible bands overlap and something is always there.
// These four are the fade windows, and how wide they are is what decides
// how fast an opacity can change while you are moving. Wider is smoother:
// the steepest an opacity can move is 1.5 / ln(SEEN/FULL) per unit of
// log-size, so widening that ratio from 2.4 to 3.2 took the worst frame of
// a hard flick from a fifth of the way through a fade to a tenth.
const SEEN = 3.4 // first shows here, three times the frame and closing
const FULL = 1.05 // fully itself from here
const LEAVING = 0.13 // starts to go once it is this small
const GONE = 0.025 // a speck, and then nothing

// The fastest the zoom may travel, in log-zoom per second.
//
// Easing alone is proportional, so a big gap gives a big *first* step: a
// flick from the hub to the galaxy moved a stage a fifth of the way
// through its fade in a single frame. A speed limit turns the long
// journeys into a steady fly-out and leaves the short ones to the easing,
// which is where proportional response belongs. The whole way out takes
// about three seconds.
//
// 1.8 rather than 2 for a measured reason: at 2 the worst frame of a hard
// flick moved a stage's opacity by 0.121, and 0.12 is the bound the
// smoothness test holds it to.
export const ZOOM_RATE = 1.8
export const ZOOM_EASE = 0.0005 // fraction of the gap left after a second
export const ZOOM_SNAP = 0.004 // close enough in log-zoom to just land

// The longest frame the zoom will integrate, in seconds.
//
// A dropped frame should make the journey take longer, not skip part of
// it. At the old tenth of a second a half-second stall jumped a stage
// through more than half its fade in one frame; at a twentieth it is a
// quarter, and nothing above twenty frames a second is affected at all.
export const ZOOM_DT_MAX = 0.05

export function cosmicStage(t, i) {
  const size = Math.pow(NEST, t - i)
  return {
    size,
    opacity: Math.min(
      1 - smoothstep(size, FULL, SEEN),
      smoothstep(size, GONE, LEAVING)
    ),
  }
}

// The transform a stage is drawn with, as the position / quaternion / scale
// a three group takes.
//
// It lives here, and both the renderer and the tests call it, so what is
// measured is the placement that is actually used.
//
// Every stage is placed so that the thing you came from sits at the world
// origin: Earth for the solar system, the sun for the galaxy, our own
// cluster for the universe. That single rule is the whole nesting. His
// planet is at that origin too, so all four scales are stacked on the same
// point and he never moves — which is both what a cosmic zoom does and, on
// this particular site, the point being made.
//
// A child point p ends up at  position + Q * (scale * p), and what we want
// is  scale * Ry(spin) * R(tilt) * (p - anchor). Those agree when
// Q = Ry(spin) * R(tilt) and position = -scale * Q * anchor.
//
// There was briefly a version that eased the anchor out as a stage settled,
// so the composition drifted from Earth-centred to sun-centred. It is gone,
// and it is worth saying why: the sun is 0.38 of a radius from Earth and
// the galactic core is 0.63 of a radius from the sun, so that drift was a
// pan across two thirds of the screen, which no easing makes smooth. Worse,
// his planet stayed nailed to the origin while the stage slid its own
// centre onto that same origin — so the sun arrived exactly where he was
// standing and swallowed him. Each stage's radius now allows for its anchor
// offset instead, and nothing moves.
const _spinQ = new THREE.Quaternion()
const _tiltE = new THREE.Euler()
const _up = new THREE.Vector3(0, 1, 0)

export function stagePlacement(stage, size, fit, spin, out) {
  const scale = (fit / stage.radius) * size
  out.quaternion
    .setFromEuler(_tiltE.set(stage.tilt[0], stage.tilt[1], stage.tilt[2]))
    .premultiply(_spinQ.setFromAxisAngle(_up, spin))

  out.position
    .set(-stage.anchor[0], -stage.anchor[1], -stage.anchor[2])
    .applyQuaternion(out.quaternion)
    .multiplyScalar(scale)

  out.scale = scale
  return out
}

// Cubic smoothstep. Written out rather than imported so the meaning of the
// fade curves is visible in this file.
function smoothstep(x, min, max) {
  const t = THREE.MathUtils.clamp((x - min) / (max - min), 0, 1)
  return t * t * (3 - 2 * t)
}

// The hub's own place on that ladder. His planet is not inside the group
// that shrinks when you zoom in — it is the thing you zoom towards — but it
// does have to shrink when you leave, so this is separate from shrinkFor.
export const nestFor = (zoom) => cosmicStage(cosmicScale(zoom), 0).size

// The hub's own opacity on the ladder, so his planet and its branches fade
// out on the same curve every stage uses rather than simply vanishing.
export const hubOpacity = (zoom) => cosmicStage(cosmicScale(zoom), 0).opacity

// And it only unmounts well after that fade has finished. At 1.55 the whole
// branch ring is under two pixels across, so pulling the subtree — which is
// what takes the DOM labels with it — cannot be seen. It used to happen at
// 1.1, where the thing was still four pixels and visibly popped.
export const HUB_GONE = 1.55

// Camera position and aim for a given zoom factor. 1 is the framing the
// view was authored at; below that the aim slides down to the planet so you
// end up looking at the ground rather than past it.
const scratch = new THREE.Vector3()

// How far he and his branches shrink at a given zoom.
//
// Exported because the labels have to use the same number. drei's Html
// scales itself from camera distance alone and ignores the scale of the
// group it sits in, so the text grew as the ring it belongs to shrank —
// zoom in and the labels swelled into each other while the model receded.
export const shrinkFor = (zoom) =>
  Math.pow(THREE.MathUtils.clamp(zoom, 0.1, 1), 1.6)

// What a branch label has to be scaled by. Html sizes itself from camera
// distance alone and ignores every group scale above it, so a label has to
// carry both of them itself: the zoom-in shrink and the nesting.
export const labelScaleFor = (zoom) => shrinkFor(zoom) * nestFor(zoom)

export function applyZoom(view, zoom, outPos, outLook) {
  scratch.copy(view.pos).sub(ZOOM_TARGET)
  outPos.copy(ZOOM_TARGET).addScaledVector(scratch, zoom)
  outLook.copy(view.look).lerp(ZOOM_TARGET, THREE.MathUtils.clamp(1 - zoom, 0, 1))
}

// How much a branch dims for sitting round the back.
//
// Half the ring is behind him at any moment, and without this the labels
// pile up on each other and read as noise rather than depth.
//
// Measured as a ratio of the camera's own distance rather than in absolute
// units, so it holds for the small phone ring as well as the desktop one —
// the old fixed constants put every phone node at the near end and nothing
// dimmed at all.
export function depthFade(world, cameraPos) {
  const ratio = world.distanceTo(cameraPos) / cameraPos.length()
  const depth = THREE.MathUtils.clamp((ratio - 0.78) / 0.42, 0, 1)
  return 1 - depth * 0.82
}



// ---------- how fast a drag turns it ----------
//
// Not a constant. The globe is 80 pixels across the radius on a phone and
// 152 on a desktop, so one rate in radians per pixel is two different
// gestures — and on the phone, where it is smallest, it was the stiffest.
//
// This is the number of radians a drag across one globe-radius turns it.
// Above 1 it is deliberately faster than the surface under your finger:
// a ball 160 pixels wide needs help, and he asked for it twice.
export const TURN_PER_RADIUS = 2.4
export const GLOBE_R = (narrow) => (narrow ? 0.95 : 1.35)

export function turnRate(w, h) {
  const r = GLOBE_R(w < 520)
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  applyZoom(HOME_VIEW, fitFor(w), pos, look)
  // How tall the world is at the globe's depth, and so how many pixels
  // its radius covers.
  const depth = pos.distanceTo(new THREE.Vector3(0, -r, 0))
  const halfWorld = Math.tan((40 * Math.PI) / 360) * depth
  const px = (r / halfWorld) * (h / 2)
  return TURN_PER_RADIUS / Math.max(px, 1)
}

// Tilt stays gentler than turn — there is only half a radian of it before
// you are looking at the top of his head.
export const TILT_RATE = 0.55

// ---------- letting go ----------
//
// A swipe that stops dead on release means the ring only ever turns as
// far as one reach of a thumb, and you have to swipe again, and again.
// On a phone that is most of what makes it feel stuck.
//
// Decay is exponential in time rather than a subtraction per frame, so
// the same gesture carries the same distance at 30fps and at 144 — a
// per-frame decrement is a different gesture on every device.
//
// The rate is chosen so an ordinary swipe is about one full turn and a
// hard flick about two, which is satisfying without being uncontrollable.
// It had to come down sharply when the turn rate went up: at the old
// decay a hard flick would have spun it four and a half times.
export const FLING_KEEP = 0.0024 // of its speed left after one second
export const FLING_STOP = 0.06 // below this it has stopped

// Where a swipe stops being a nudge, in pixels a second rather than
// radians. A nudge is a distance a thumb moved, not an angle — so when
// the turn rate nearly tripled, a 30-pixel adjustment went from stopping
// dead to running on, without this line being touched. Measured: a nudge
// is about 100 px/s, an ordinary swipe 1250.
export const FLING_MIN_PX = 300

export const flung = (vx, vy, rate) => {
  const min = FLING_MIN_PX * rate
  return Math.abs(vx) > min || Math.abs(vy) > min
}

// One frame of coasting: how far it turns, and what speed is left.
//
// The distance is the exact integral of the decay across the frame, not
// speed times time. Multiplying is Euler integration, and it overshoots
// in proportion to how long the frame was — measured, a swipe carried 396
// degrees at 30fps against 367 at 144, which is the slow phone getting a
// different gesture from the fast one. Since the decay is k^t, the area
// under it has a closed form and there is no reason to approximate.
export function coast(v, dt) {
  const step = Math.min(dt, 0.05)
  const left = v * Math.pow(FLING_KEEP, step)
  return { moved: (left - v) / Math.log(FLING_KEEP), left }
}

// Travelling holds one camera position and turns the world instead: the
// branch you picked spins round to the front, the way a carousel brings
// the thing you asked for to face you.
//
// The camera used to swing round to the branch's own side of the ring,
// which meant a branch behind him stayed behind him.
// Where the camera goes when a chapter is open.
//
// On a desktop it aims left of him, so he sits in the right half and the
// reading panel gets the left to itself. On a phone the panel is a bottom
// sheet rather than a column, so there is nothing to make room for
// sideways — and aiming left there pushed him and every one of his
// branches clean off the right edge of the screen.
//
// So a phone aims straight at him and sits back far enough to fit the row
// of branches into the band above the panel.
const BRANCH_AIM = 1.2 // how far left of him to look, on a wide screen

export function branchView(narrow) {
  const pos = new THREE.Vector3(0, narrow ? 2.6 : 2.25, narrow ? 7.4 : 6.2)
  if (!narrow) {
    const forward = CHEST.clone().sub(pos).normalize()
    const right = forward.clone().cross(UP).normalize()
    return { pos, look: CHEST.clone().addScaledVector(right, -BRANCH_AIM) }
  }
  // Aimed low, which lifts everything up the screen. At -0.69 the row
  // landed correctly but he did not: only 18 pixels of his scalp cleared
  // the panel, 14 per cent of him, which is not a model of anyone. This
  // puts the row near the top of the free band and all of him under it.
  return { pos, look: new THREE.Vector3(0, -1.16, 0) }
}

// The turntable angle that puts a node at the front of the ring, chosen as
// the equivalent nearest the current angle so it takes the short way round
// instead of unwinding several turns.
export function spinToFront(node, current) {
  const want = -(node.angle ?? 0)
  return want + Math.round((current - want) / (Math.PI * 2)) * Math.PI * 2
}
