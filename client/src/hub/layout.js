import * as THREE from 'three'
import { HEAD_Y } from './Figure.jsx'

export const HEAD = new THREE.Vector3(0, HEAD_Y + 0.06, 0)

// Hand-placed rather than evenly divided, so it reads as a thought
// rather than a pie chart.
const LAYOUT = [
  { a: -1.15, r: 2.9, y: 2.05 },
  { a: -0.55, r: 3.25, y: 2.75 },
  { a: 0.0, r: 3.05, y: 3.05 },
  { a: 0.58, r: 3.3, y: 2.7 },
  { a: 1.18, r: 2.85, y: 2.0 },
]

// Rooms sit low and close, under the chapters: places rather than years.
// Kept up and in, clear of the name block in the bottom-left corner.
const ROOM_LAYOUT = [
  { a: -0.45, r: 2.15, y: 1.28 },
  { a: 0.45, r: 2.15, y: 1.28 },
  { a: -0.9, r: 2.45, y: 1.02 },
  { a: 0.9, r: 2.45, y: 1.02 },
]

export function placeRooms(rooms) {
  return rooms.map((room, i) => {
    const { a, r, y } = ROOM_LAYOUT[i] ?? ROOM_LAYOUT[0]
    return {
      ...room,
      ring: 'room',
      pos: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * 0.5 + 0.5),
    }
  })
}

export function placeNodes(chapters) {
  return chapters.map((c, i) => {
    const { a, r, y } = LAYOUT[i] ?? LAYOUT[2]
    return {
      ...c,
      pos: new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r * 0.42 - 0.3),
    }
  })
}

// Where the camera sits when nothing is selected.
export const HOME_VIEW = {
  pos: new THREE.Vector3(0, 2.3, 7.8),
  look: new THREE.Vector3(0, 2.0, 0),
}

// Travelling to a branch. The look target is pushed left of the node so the
// node lands right-of-centre and the reading panel gets the left half.
export function viewFor(node) {
  const off = new THREE.Vector3(-0.95, 0, 0)
  return {
    pos: node.pos.clone().add(new THREE.Vector3(-0.95, 0.08, 2.55)),
    look: node.pos.clone().add(off),
  }
}
