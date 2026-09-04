// Geometry checks for the hub and for the scales past it.
//
// These exist because the hub's framing and fading regressed three times in
// a row, and none of it could be caught by eye: the preview pane this was
// built in pauses requestAnimationFrame outright, so the frame loop that
// writes opacity and scale never ticks there. Nothing about the zoom range
// was observable. It is all arithmetic, so it can be asserted.
//
// Run with: npm test
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  HOME_VIEW,
  STAGES,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_HUB_MAX,
  applyZoom,
  cosmicScale,
  cosmicStage,
  depthFade,
  fitFor,
  labelScaleFor,
  nestFor,
  placeNodes,
  placeRooms,
  shrinkFor,
} from './layout.js'
import { PLANETS, galaxy, solarSystem, universe } from './cosmos.js'

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

// A sweep of the hub's own zoom range, since the bug was always at one end
// of it rather than at the framing the view was authored for.
const sweep = (width) => {
  const out = []
  for (let z = ZOOM_MIN; z <= ZOOM_HUB_MAX + 1e-9; z += 0.05) {
    out.push(sceneAt(z, width))
  }
  return out
}

test('shrinkFor is 1 at the authored framing and shrinks as you zoom in', () => {
  assert.equal(shrinkFor(1), 1)
  assert.ok(shrinkFor(0.5) < shrinkFor(0.75))
  assert.ok(shrinkFor(0.75) < shrinkFor(1))
  // Zooming out must not blow him up past his authored size.
  assert.equal(shrinkFor(ZOOM_HUB_MAX), 1)
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

// ---------- the ladder out ----------

const ladder = (steps = 900) => {
  const out = []
  for (let i = 0; i <= steps; i++) {
    // Geometric, because that is how the zoom itself moves.
    const z = ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, i / steps)
    out.push({ z, t: cosmicScale(z) })
  }
  return out
}

const STAGE_IDS = [0, ...STAGES.map((_, i) => i + 1)]

test('the hub range is untouched by the ladder', () => {
  // Everything about zooming in has to behave exactly as it did before
  // there was anywhere else to go.
  for (let z = ZOOM_MIN; z <= ZOOM_HUB_MAX; z += 0.05) {
    // Accumulated 0.05s overshoot ZOOM_HUB_MAX by a float hair, so this is
    // a tolerance rather than an equality.
    assert.ok(cosmicScale(z) < 1e-12, `zoom ${z.toFixed(2)} left the hub early`)
    assert.ok(Math.abs(nestFor(z) - 1) < 1e-12)
    assert.ok(Math.abs(labelScaleFor(z) - shrinkFor(z)) < 1e-12)
  }
})

test('the ladder runs from the hub to the last stage and no further', () => {
  assert.equal(cosmicScale(ZOOM_HUB_MAX), 0)
  // The far end of the zoom range lands exactly on the outermost stage,
  // rather than short of it or past it into nothing.
  assert.ok(Math.abs(cosmicScale(ZOOM_MAX) - STAGES.length) < 1e-9)
})

test('the ladder is continuous — no stage pops into being', () => {
  // The whole illusion is that one scale becomes the next without a seam,
  // and a seam is exactly what a threshold bug produces.
  const rungs = ladder()
  for (let i = 1; i < rungs.length; i++) {
    for (const stage of STAGE_IDS) {
      const a = cosmicStage(rungs[i - 1].t, stage)
      const b = cosmicStage(rungs[i].t, stage)
      assert.ok(
        Math.abs(a.opacity - b.opacity) < 0.05,
        `stage ${stage} jumped ${Math.abs(a.opacity - b.opacity).toFixed(3)} in opacity near zoom ${rungs[i].z.toFixed(1)}`
      )
      // Scale is geometric, so compare it as a ratio.
      assert.ok(
        Math.abs(Math.log(b.scale / a.scale)) < 0.05,
        `stage ${stage} jumped in scale near zoom ${rungs[i].z.toFixed(1)}`
      )
    }
  }
})

test('there is always something to look at, and never a crowd', () => {
  for (const { z, t } of ladder(400)) {
    const lit = STAGE_IDS.filter((i) => cosmicStage(t, i).opacity > 0.02)
    assert.ok(lit.length >= 1, `nothing visible at zoom ${z.toFixed(1)}`)
    // Two at a time is the cross-fade. Three would be a mess, and would
    // mean the fade windows had drifted wider than the spacing.
    assert.ok(lit.length <= 2, `${lit.length} stages at once at zoom ${z.toFixed(1)}`)
  }
})

test('each stage is fully itself somewhere', () => {
  // A stage whose opacity never reaches 1 is one you never arrive at.
  for (const i of STAGE_IDS) {
    const peak = Math.max(...ladder(400).map(({ t }) => cosmicStage(t, i).opacity))
    assert.ok(peak > 0.99, `stage ${i} peaks at only ${peak.toFixed(3)}`)
  }
})

test('his planet becomes a dot in the solar system, not a rival to it', () => {
  // The nesting read. His planet does not have to be *small* by the time
  // the solar system arrives — it has to be small *relative to it*. Both
  // sit at the origin, because the stage is slid to put Earth there, so
  // what matters is the ratio of the two apparent sizes.
  const full = ladder(400).find(({ t }) => cosmicStage(t, 1).opacity > 0.99)
  assert.ok(full, 'the solar system never fully arrives')

  const NEPTUNE = PLANETS[PLANETS.length - 1][1]
  const his = nestFor(full.z) * 1.35 // globe radius at the hub
  const theirs = cosmicStage(full.t, 1).scale * NEPTUNE
  assert.ok(
    his / theirs < 0.05,
    `his planet was ${((his / theirs) * 100).toFixed(1)}% of the solar system`
  )

  // And by the far end of the first stage he is inside Earth's own dot,
  // which is the moment the two become the same object.
  const earthDot = PLANETS[2][2]
  assert.ok(nestFor(ZOOM_HUB_MAX * 6) * 1.35 < earthDot * 1.2)
})

// ---------- what is actually out there ----------

const finite = (a) => a.every((v) => Number.isFinite(v))

test('the solar system is eight planets on eight orbits', () => {
  const { orbits, planets } = solarSystem()
  assert.equal(planets.length, PLANETS.length)
  assert.equal(orbits.length % 6, 0, 'line segments come in pairs of points')
  assert.ok(finite(orbits))
  // Each planet on its own ring, in order, none touching the next.
  for (let i = 1; i < planets.length; i++) {
    assert.ok(
      planets[i].orbit > planets[i - 1].orbit + planets[i].size,
      `${planets[i].name} sits on top of ${planets[i - 1].name}`
    )
  }
  // And each one actually on the ring it belongs to.
  for (const p of planets) {
    const r = Math.hypot(p.pos[0], p.pos[2])
    assert.ok(Math.abs(r - p.orbit) < 1e-9, `${p.name} is off its orbit`)
  }
})

test('the galaxy is a disc, not a ball or a cloud of NaN', () => {
  const g = galaxy({ count: 4000, seed: 3 })
  assert.ok(finite(g.pos))
  assert.ok(finite(g.col))

  let maxR = 0
  let maxY = 0
  for (let i = 0; i < g.pos.length; i += 3) {
    maxR = Math.max(maxR, Math.hypot(g.pos[i], g.pos[i + 2]))
    maxY = Math.max(maxY, Math.abs(g.pos[i + 1]))
  }
  // Points scatter past the nominal radius; they must not run away.
  assert.ok(maxR < g.radius * 1.35, `galaxy reached ${maxR.toFixed(1)}`)
  // Flat: far wider than it is thick, or it does not read as a galaxy.
  assert.ok(maxY < maxR * 0.25, `thickness ${maxY.toFixed(2)} vs radius ${maxR.toFixed(1)}`)
  // Colours in gamut, or three.js clamps them into stripes.
  assert.ok(g.col.every((c) => c >= 0 && c <= 1))
  // The sun sits out in the disc, not in the core and not off the rim.
  const sunR = Math.hypot(g.sun[0], g.sun[2])
  assert.ok(sunR > g.radius * 0.4 && sunR < g.radius * 0.8)
})

test('the universe clusters rather than being static', () => {
  const u = universe({ clusters: 40, perCluster: 10, field: 60, seed: 5 })
  assert.ok(finite(u.pos))
  assert.ok(finite(u.web))
  assert.equal(u.pos.length / 3, 40 * 10 + 60)
  // Every filament is a pair of cluster centres: a multiple of 6 floats.
  assert.equal(u.web.length % 6, 0)
  assert.ok(u.web.length > 0, 'no cosmic web at all')

  // The actual test of clustering: mean nearest-neighbour distance should
  // be well under what an even spread through the same ball would give.
  // Static would put that ratio near 1.
  const n = u.pos.length / 3
  let sum = 0
  for (let i = 0; i < n; i++) {
    let best = Infinity
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const dx = u.pos[i * 3] - u.pos[j * 3]
      const dy = u.pos[i * 3 + 1] - u.pos[j * 3 + 1]
      const dz = u.pos[i * 3 + 2] - u.pos[j * 3 + 2]
      best = Math.min(best, dx * dx + dy * dy + dz * dz)
    }
    sum += Math.sqrt(best)
  }
  const mean = sum / n
  const even = u.radius / Math.cbrt(n)
  assert.ok(
    mean < even * 0.6,
    `mean spacing ${mean.toFixed(2)} vs even ${even.toFixed(2)} — not clustered`
  )
})

console.log('\n' + passed + ' passed')
