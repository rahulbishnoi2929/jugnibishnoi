import * as THREE from 'three'

// How high his head sits. Lives here rather than in Figure.jsx so this
// module stays plain geometry with no React in its import graph — that is
// what lets layout.test.mjs run it under node. Figure imports it back.
export const HEAD_Y = 1.78

// The crown, not the centre of the skull — 0.06 put the junction inside
// his head, so the branches read as passing through his face.
export const HEAD = new THREE.Vector3(0, HEAD_Y + 0.15, 0)

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

const RING = {
  wide: { chapters: { r: 3.0, y: 2.25 }, rooms: { r: 2.5, y: 1.1 } },
  narrow: { chapters: { r: 1.5, y: 1.45 }, rooms: { r: 1.28, y: 0.72 } },
}

// How far to lift the whole hub, in world units, for a given viewport.
//
// A portrait phone is 812 tall and the composition is 344 of that. Centred,
// which is where it was, that leaves 230 pixels of empty sky above it and
// 38 below before the name — all the slack piled at the top, which reads as
// a broken layout rather than as space. Lifting it puts about 150 above and
// 120 between it and the copy, so the page is a column: art, name, links.
//
// Nothing on a wider screen needs this. The desktop composition is already
// centred, and the copy there sits over the globe on purpose.
export const liftFor = (w) => (w < 520 ? 1.0 : 0)

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

// A chapter's own branches, fanned out from its node. They open to the
// right because the reading panel owns the left half of the screen.
//
// Offsets are from the node, in world space — the ring is frozen at a
// known angle while a chapter is open, so this needs no extra maths.
// Down and to the right of the node: above it is off the top of the frame,
// and left of it is under the reading panel.
const FAN = [
  [0.34, -0.3, 0.1],
  [0.4, -0.9, -0.05],
  [0.26, -1.45, 0.15],
  [-0.06, -1.9, -0.1],
]

export function placeBranches(node, branches = [], narrow) {
  // The offsets are what we want to see on screen, but these nodes live
  // inside the turntable, which is counter-rotated by the node's own angle
  // while its chapter is open. Pre-rotating by that angle cancels it out —
  // without this the fan swung round and opened behind the panel.
  const spin = node.angle ?? 0

  return branches.map((b, i) => {
    const k = narrow ? 0.68 : 1
    const [dx, dy, dz] = FAN[i % FAN.length]
    const offset = new THREE.Vector3(dx * k, dy * k, dz * k).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      spin
    )
    return { ...b, parent: node.pos, pos: node.pos.clone().add(offset) }
  })
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

// Travelling holds one camera position and turns the world instead: the
// branch you picked spins round to the front, the way a carousel brings
// the thing you asked for to face you.
//
// The camera used to swing round to the branch's own side of the ring,
// which meant a branch behind him stayed behind him.
export const BRANCH_VIEW = (() => {
  const pos = new THREE.Vector3(0, 2.25, 6.4)

  // Aim left of him, so he sits in the right half and the panel gets the
  // left half to itself.
  const forward = CHEST.clone().sub(pos).normalize()
  const right = forward.clone().cross(UP).normalize()
  const look = CHEST.clone().addScaledVector(right, -1.85)

  return { pos, look }
})()

// The turntable angle that puts a node at the front of the ring, chosen as
// the equivalent nearest the current angle so it takes the short way round
// instead of unwinding several turns.
export function spinToFront(node, current) {
  const want = -(node.angle ?? 0)
  return want + Math.round((current - want) / (Math.PI * 2)) * Math.PI * 2
}
