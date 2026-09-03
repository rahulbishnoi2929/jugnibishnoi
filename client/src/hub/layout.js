import * as THREE from 'three'
import { HEAD_Y } from './Figure.jsx'

export const HEAD = new THREE.Vector3(0, HEAD_Y + 0.06, 0)

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

// Chapters ride high and wide, in order, so spinning walks the years.
export function placeNodes(chapters) {
  return ring(chapters, { r: 3.0, y: 2.5, phase: 0 })
}

// Rooms sit lower and tighter, offset half a step so one never hides
// directly behind a chapter.
export function placeRooms(rooms) {
  return ring(rooms, { r: 2.5, y: 1.1, phase: Math.PI / 5 }).map((n) => ({
    ...n,
    ring: 'room',
  }))
}

// Where the camera sits when nothing is selected.
export const HOME_VIEW = {
  pos: new THREE.Vector3(0, 2.35, 8.7),
  look: new THREE.Vector3(0, 2.0, 0),
}

const CHEST = new THREE.Vector3(0, 1.2, 0)
const UP = new THREE.Vector3(0, 1, 0)

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
