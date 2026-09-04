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
export const ZOOM_MAX = 2.2

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
