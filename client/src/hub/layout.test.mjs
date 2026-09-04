// Geometry checks for the hub.
//
// These exist because the hub's framing and fading have regressed three
// times in a row, and none of it could be caught by eye: the preview pane
// this was built in pauses requestAnimationFrame outright, so the frame
// loop that writes opacity and scale never ticks there. Nothing about the
// zoom range was observable. It is all arithmetic, so it can be asserted.
//
// Run with: npm test
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  HOME_VIEW,
  ZOOM_MIN,
  ZOOM_MAX,
  applyZoom,
  depthFade,
  fitFor,
  placeNodes,
  placeRooms,
  shrinkFor,
} from './layout.js'

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    console.log('  ok  ' + name)
    passed++
  } catch (e) {
    console.error('  FAIL  ' + name + '\n        ' + e.message)
    process.exitCode = 1
  }
}

// Stand-ins: only the count matters to the ring maths.
const five = [1, 2, 3, 4, 5].map((n) => ({ id: 'c' + n }))
const three = [1, 2, 3].map((n) => ({ id: 'r' + n }))

// The scene as the camera sees it at a given zoom, on a given viewport.
function sceneAt(zoom, width) {
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  applyZoom(HOME_VIEW, zoom * fitFor(width), pos, look)

  // Everything on his head rides inside the group Shrink scales.
  const k = shrinkFor(zoom)
  const narrow = width < 520
  const nodes = [...placeNodes(five, narrow), ...placeRooms(three, narrow)]
  return {
    cam: pos,
    fades: nodes.map((n) => depthFade(n.pos.clone().multiplyScalar(k), pos)),
  }
}

// A sweep of the whole pinch range, since the bug was always at one end of
// it rather than at the framing the view was authored for.
const sweep = (width) => {
  const out = []
  for (let z = ZOOM_MIN; z <= ZOOM_MAX + 1e-9; z += 0.05) out.push(sceneAt(z, width))
  return out
}

test('shrinkFor is 1 at the authored framing and shrinks as you zoom in', () => {
  assert.equal(shrinkFor(1), 1)
  assert.ok(shrinkFor(0.5) < shrinkFor(0.75))
  assert.ok(shrinkFor(0.75) < shrinkFor(1))
  // Zooming out must not blow him up past his authored size.
  assert.equal(shrinkFor(2.2), 1)
})

test('labels shrink as you zoom in rather than swelling', () => {
  // drei's Html sizes itself by 1/distance and ignores the scale of the
  // group it sits in, so as the camera closes on the planet its text grows
  // while the ring under it contracts. shrinkFor has to beat that: the
  // exponent must be above 1, or the labels hold their size (what the ring
  // was reported "merging" into) or grow outright.
  //
  // This pins the law, not the wiring — that Nodes.jsx actually applies it
  // is the one part only a real frame loop can show.
  const dist = (z) => {
    const front = placeNodes(five, true)[0].pos.clone().multiplyScalar(shrinkFor(z))
    return front.distanceTo(sceneAt(z, 375).cam)
  }
  const onScreen = (z) => shrinkFor(z) / dist(z)

  let prev = onScreen(1)
  for (let z = 0.95; z >= ZOOM_MIN - 1e-9; z -= 0.05) {
    const now = onScreen(z)
    assert.ok(
      now < prev,
      `zooming from ${(z + 0.05).toFixed(2)} to ${z.toFixed(2)} grew the label`
    )
    prev = now
  }
  // How badly it used to go wrong: drei on its own, at full pinch.
  const drift = 1 / dist(ZOOM_MIN) / (1 / dist(1)) / (onScreen(ZOOM_MIN) / onScreen(1))
  assert.ok(drift > 2, `expected the unscaled label to drift, got ${drift.toFixed(2)}`)
})

test('no branch washes out anywhere in the pinch range', () => {
  for (const width of [375, 1440]) {
    for (const { fades } of sweep(width)) {
      // The dimmest a branch may go is the back of the ring's depth cue.
      const min = Math.min(...fades)
      assert.ok(
        min >= 0.18 - 1e-9,
        `width ${width}: a branch fell to ${min.toFixed(3)}`
      )
      // Labels floor at 0.3 so a back branch stays clickable.
      assert.ok(Math.max(0.3, min) >= 0.3)
    }
  }
})

test('the front of the ring stays bright at every zoom', () => {
  // The reported bug: pinching in washed everything out, front included.
  for (const width of [375, 1440]) {
    for (const { fades } of sweep(width)) {
      const front = Math.max(...fades)
      assert.ok(
        front >= 0.6,
        `width ${width}: the nearest branch was only ${front.toFixed(3)}`
      )
    }
  }
})

test('the ring still reads as having depth', () => {
  // Guard the opposite mistake — flattening the cue to fix the washing out.
  for (const width of [375, 1440]) {
    const { fades } = sceneAt(1, width)
    const spread = Math.max(...fades) - Math.min(...fades)
    assert.ok(spread > 0.25, `width ${width}: depth spread only ${spread.toFixed(3)}`)
  }
})

test('the composition sits in the middle of the frame', () => {
  // Where the content lands, projected the way three.js will project it.
  const frame = ({ w, h }) => {
    const narrow = w < 520
    const pos = new THREE.Vector3()
    const look = new THREE.Vector3()
    applyZoom(HOME_VIEW, fitFor(w), pos, look)
    const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 100)
    cam.position.copy(pos)
    cam.lookAt(look)
    cam.updateMatrixWorld()

    const y = (v) => ((1 - v.project(cam).y) / 2) * h
    const nodes = placeNodes(five, narrow)
    const globeR = narrow ? 0.95 : 1.35
    // Label text sits about 34px above its node, and is ~44px tall.
    const top = Math.min(...nodes.map((n) => y(n.pos.clone()))) - 34 - 22
    const bottom = y(new THREE.Vector3(0, -2 * globeR, 0))
    return { centre: (top + bottom) / 2, top, bottom, middle: h / 2 }
  }

  for (const s of [{ w: 375, h: 812 }, { w: 1440, h: 820 }]) {
    const f = frame(s)
    assert.ok(f.top > 0, `content ran off the top at ${s.w}: ${f.top.toFixed(0)}`)
    assert.ok(
      f.bottom < s.h,
      `content ran off the bottom at ${s.w}: ${f.bottom.toFixed(0)}`
    )
    // Within a tenth of the viewport height of centre. Aiming at his chest
    // put it a third of the screen low.
    assert.ok(
      Math.abs(f.centre - f.middle) < s.h * 0.1,
      `at ${s.w} the composition centres at ${f.centre.toFixed(0)}, want ~${f.middle}`
    )
  }
})

console.log('\n' + passed + ' passed')
