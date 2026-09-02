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
  // left room rides higher: its dot was landing on the Mehrajpur line
  { a: -0.45, r: 2.15, y: 1.55 },
  { a: 0.45, r: 2.15, y: 1.28 },
  // third room goes right, not left — the name block owns the bottom-left
  { a: 0.95, r: 2.45, y: 1.0 },
  { a: -0.95, r: 2.45, y: 1.0 },
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

const CHEST = new THREE.Vector3(0, 1.2, 0)
const UP = new THREE.Vector3(0, 1, 0)

// Travelling to a branch orbits the camera around the figure, part way
// towards whichever branch you picked — so every chapter has its own
// viewpoint and he is on screen in all of them, turning to face it.
//
// Framing the node itself put him behind the reading panel, which made the
// turn pointless: you could not see him do it.
export function viewFor(node) {
  const az = Math.atan2(node.pos.x, node.pos.z + 2.5) * 0.62
  const pos = new THREE.Vector3(Math.sin(az) * 5.4, 2.2, Math.cos(az) * 5.4)

  // Aim left of him, so he sits in the right half and the panel gets the
  // left half to itself.
  const forward = CHEST.clone().sub(pos).normalize()
  const right = forward.clone().cross(UP).normalize()
  const look = CHEST.clone().addScaledVector(right, -1.85)

  return { pos, look }
}
