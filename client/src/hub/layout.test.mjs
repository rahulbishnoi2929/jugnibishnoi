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
  fitRadius,
  labelScaleFor,
  nestFor,
  placeNodes,
  placeRooms,
  shrinkFor,
  stagePlacement,
} from './layout.js'
import { PLANETS, galaxy, orbitOf, solarSystem, starfield, universe } from './cosmos.js'

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
//
// These assertions are in screen pixels, not world units, because world
// units are exactly what hid the first version's failure. All three stages
// were scaled by one shared factor while their local radii were 5.3, 22 and
// 70, so the solar system reached full opacity at four times the width of
// the frame, the galaxy at thirteen times and the universe at thirty-eight.
// The maths was self-consistent and the pictures were unusable. Nothing
// here is believed until it has been projected onto a viewport.

const VIEWPORTS = [
  { name: 'phone', w: 375, h: 812 },
  { name: 'desktop', w: 1440, h: 820 },
]

// The camera as Travel leaves it once you are past the hub's own range.
function outsideCamera({ name, w, h }) {
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  applyZoom(HOME_VIEW, ZOOM_HUB_MAX * fitFor(w), pos, look)
  const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 2000)
  cam.position.copy(pos)
  cam.lookAt(look)
  cam.updateMatrixWorld()
  const dist = cam.position.length()
  return {
    name,
    cam,
    dist,
    fit: fitRadius(cam, dist),
    // three's own point-size rule, and the projection scale generally.
    unitPx: h / 2 / (dist * Math.tan(Math.PI / 9)),
  }
}

const place = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  scale: 1,
}
const _m = new THREE.Matrix4()
const _s = new THREE.Vector3()

// Where a point of a stage lands, in fractions of the viewport.
function screenOf(stage, size, view, point) {
  stagePlacement(stage, size, view.fit, 0, place)
  _m.compose(place.position, place.quaternion, _s.setScalar(place.scale))
  const n = new THREE.Vector3(point[0], point[1], point[2])
    .applyMatrix4(_m)
    .project(view.cam)
  return { x: (n.x + 1) / 2, y: (1 - n.y) / 2, scale: place.scale }
}

const ladder = (steps = 600) => {
  const out = []
  for (let i = 0; i <= steps; i++) {
    const z = ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, i / steps)
    out.push({ z, t: cosmicScale(z) })
  }
  return out
}

const STAGE_IDS = [0, ...STAGES.map((_, i) => i + 1)]

// Built once; the tests below only read them.
const SOLAR = solarSystem()
const GALAXY = galaxy({ count: 6000 })
const UNIVERSE = universe({ clusters: 60, perCluster: 10, field: 100 })
const SKY = starfield()
const BODIES = [SOLAR, GALAXY, UNIVERSE]

const radii = (arr) => {
  const out = []
  for (let i = 0; i < arr.length; i += 3) {
    out.push(Math.hypot(arr[i], arr[i + 1], arr[i + 2]))
  }
  return out
}
const chunk = (arr) => {
  const out = []
  for (let i = 0; i < arr.length; i += 3) out.push([arr[i], arr[i + 1], arr[i + 2]])
  return out
}
const finite = (a) => a.every((v) => Number.isFinite(v))

test('the hub range is untouched by the ladder', () => {
  // Everything about zooming in has to behave exactly as it did before
  // there was anywhere else to go.
  for (let z = ZOOM_MIN; z <= ZOOM_HUB_MAX; z += 0.05) {
    assert.ok(cosmicScale(z) < 1e-12, `zoom ${z.toFixed(2)} left the hub early`)
    assert.ok(Math.abs(nestFor(z) - 1) < 1e-12)
    assert.ok(Math.abs(labelScaleFor(z) - shrinkFor(z)) < 1e-12)
  }
})

test('the ladder ends exactly on the outermost stage', () => {
  assert.equal(cosmicScale(ZOOM_HUB_MAX), 0)
  assert.ok(Math.abs(cosmicScale(ZOOM_MAX) - STAGES.length) < 1e-9)
})

test('the ladder is continuous — no stage pops into being', () => {
  const rungs = ladder(3000)
  for (let i = 1; i < rungs.length; i++) {
    for (const stage of STAGE_IDS) {
      const a = cosmicStage(rungs[i - 1].t, stage)
      const b = cosmicStage(rungs[i].t, stage)
      assert.ok(
        Math.abs(a.opacity - b.opacity) < 0.05,
        `stage ${stage} jumped ${Math.abs(a.opacity - b.opacity).toFixed(3)} in opacity near zoom ${rungs[i].z.toFixed(1)}`
      )
      assert.ok(
        Math.abs(Math.log(b.size / a.size)) < 0.05,
        `stage ${stage} jumped in size near zoom ${rungs[i].z.toFixed(1)}`
      )
    }
  }
})

test('there is never an empty screen on the way out', () => {
  // The failure this replaces: between the hub and the solar system there
  // was four fifths of a ladder step with nothing drawn at all.
  for (const { z, t } of ladder()) {
    const lit = STAGE_IDS.filter((i) => cosmicStage(t, i).opacity > 0.05)
    const sky = t > 0.15
    assert.ok(
      lit.length >= 1 || sky,
      `nothing on screen at zoom ${z.toFixed(1)} (t ${t.toFixed(2)})`
    )
    // Two at a time is the cross-fade; three would be a mess.
    assert.ok(lit.length <= 2, `${lit.length} stages at once at zoom ${z.toFixed(1)}`)
  }
})

test('a stage is only ever fully shown at a size that fits the screen', () => {
  // The original bug, stated as a rule. A stage may be larger than the
  // frame while it is arriving — that is what pulling away from something
  // looks like — but never while it is the subject.
  for (const { z, t } of ladder()) {
    for (let i = 1; i <= STAGES.length; i++) {
      const { size, opacity } = cosmicStage(t, i)
      if (opacity > 0.999) {
        assert.ok(
          size <= 1.2,
          `${STAGES[i - 1]} is fully opaque at ${size.toFixed(2)}x the frame (zoom ${z.toFixed(1)})`
        )
      }
      assert.ok(
        opacity < 0.01 || size < 3.2,
        `${STAGES[i - 1]} visible at ${size.toFixed(1)}x the frame (zoom ${z.toFixed(1)})`
      )
    }
  }
})

test('each stage is fully itself somewhere, and near the frame size', () => {
  for (const i of STAGE_IDS) {
    let peak = 0
    let sizeAtPeak = null
    for (const { t } of ladder()) {
      const s = cosmicStage(t, i)
      if (s.opacity > peak) {
        peak = s.opacity
        sizeAtPeak = s.size
      }
    }
    assert.ok(peak > 0.99, `stage ${i} peaks at only ${peak.toFixed(3)}`)
    assert.ok(
      sizeAtPeak > 0.5,
      `stage ${i} is only ${sizeAtPeak.toFixed(2)} of the frame at its best`
    )
  }
})

test('every stage lands on screen when it is the subject', () => {
  for (const vp of VIEWPORTS) {
    const view = outsideCamera(vp)
    for (const stage of BODIES) {
      const pts = stage.planets ? stage.planets.map((p) => p.pos) : chunk(stage.pos)
      let off = 0
      for (const p of pts) {
        const s = screenOf(stage, 1, view, p)
        if (s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1) off++
      }
      const inside = 1 - off / pts.length
      assert.ok(
        inside > 0.93,
        `${view.name}: only ${(inside * 100).toFixed(0)}% of ${stage.id} is on screen when it is the subject`
      )
    }
  }
})

test('the composition hands over from Earth to the sun', () => {
  // Arriving, a stage is anchored on the thing you came from so the two
  // line up as one shrinks into the other. Settled, it has to be centred on
  // itself, or the sun sits a third of the way off frame and Neptune's
  // orbit hangs over the edge.
  const view = outsideCamera(VIEWPORTS[0])
  const off = (p) => Math.hypot(p.x - 0.5, p.y - 0.5)

  // Arriving: Earth is the middle of the screen, because that is where his
  // planet is and the two have to occupy the same spot to hand over.
  const earthArriving = screenOf(SOLAR, 2.8, view, SOLAR.anchor)
  assert.ok(
    off(earthArriving) < 0.02,
    `Earth should be dead centre while the stage arrives, was ${off(earthArriving).toFixed(3)} away`
  )

  // Settled: the sun is, and Earth has slid out to its own orbit.
  const sunSettled = screenOf(SOLAR, 1.0, view, [0, 0, 0])
  const earthSettled = screenOf(SOLAR, 1.0, view, SOLAR.anchor)
  assert.ok(
    off(sunSettled) < 0.02,
    `the sun should be centred once settled, was ${off(sunSettled).toFixed(3)} away`
  )
  assert.ok(
    off(earthSettled) > 0.04,
    `Earth should have moved off centre onto its orbit, was ${off(earthSettled).toFixed(3)} away`
  )
})

// ---------- the solar system, in pixels ----------

test('the solar system is drawn from its real orbital elements', () => {
  // The compression of distance and size is deliberate. The shape of each
  // orbit is not allowed to be: real eccentricity with the sun at a focus,
  // real inclination out of the ecliptic.
  assert.deepEqual(
    SOLAR.planets.map((p) => p.name),
    PLANETS.map((p) => p.name)
  )

  for (let i = 0; i < SOLAR.planets.length; i++) {
    const p = SOLAR.planets[i]
    const el = PLANETS[i]
    if (i > 0) {
      assert.ok(
        p.orbit > SOLAR.planets[i - 1].orbit,
        `${p.name} is drawn inside ${SOLAR.planets[i - 1].name}`
      )
    }

    const first = p.path[0]
    const last = p.path[p.path.length - 1]
    assert.ok(
      Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) < 1e-9,
      `${p.name}'s orbit is not a closed loop`
    )

    // The sun at a focus means the near and far points differ by 2ae, so
    // this ratio recovers the eccentricity. A circle would fail it, and
    // Mercury's 0.206 is visible on screen.
    const rs = p.path.map((q) => Math.hypot(q[0], q[1], q[2]))
    const spread =
      (Math.max(...rs) - Math.min(...rs)) / (Math.max(...rs) + Math.min(...rs))
    assert.ok(
      Math.abs(spread - el.e) < 0.02,
      `${p.name} drawn at eccentricity ${spread.toFixed(3)}, elements say ${el.e}`
    )

    // Inclination: a tipped orbit has to leave the ecliptic by the right
    // amount, and Earth — which defines the plane — must stay in it.
    const rise = Math.max(...p.path.map((q) => Math.abs(q[1]))) / p.orbit
    const want = Math.sin((el.inc * Math.PI) / 180)
    assert.ok(
      Math.abs(rise - want) < 0.02,
      `${p.name} rises ${rise.toFixed(3)} out of plane, inclination says ${want.toFixed(3)}`
    )
  }
})

test('the belts land where the real ones do', () => {
  // 2.1-3.3 AU and 30-50 AU, put through the same compression as the
  // planets, so the main belt has to fall into the Mars-Jupiter gap on its
  // own rather than by being placed there.
  const mars = SOLAR.planets[3].orbit
  const jupiter = SOLAR.planets[4].orbit
  for (const r of radii(SOLAR.asteroids)) {
    assert.ok(
      r > mars && r < jupiter,
      `an asteroid at ${r.toFixed(3)} is not between Mars and Jupiter`
    )
  }
  const neptune = SOLAR.planets[7].orbit
  for (const r of radii(SOLAR.kuiper)) {
    assert.ok(r > neptune * 0.97, `a Kuiper object at ${r.toFixed(3)} is inside Neptune`)
  }
  assert.ok(Math.abs(orbitOf(30.047) - 1) < 1e-9, 'Neptune should define the unit radius')
})

test('every planet is a visible dot, clear of its neighbours', () => {
  // The measurements that matter, on the smallest screen there is. The
  // first attempt drew Earth at 1.9px with a 4px gap to Venus, so the dots
  // touched across two different orbits.
  const view = outsideCamera(VIEWPORTS[0])
  const scale = view.fit / SOLAR.radius // stage size 1: the subject
  const pxOf = (v) => v * scale * view.unitPx

  const halo = pxOf(SOLAR.sun) * 1.7
  assert.ok(
    pxOf(SOLAR.planets[0].orbit) > halo * 1.4,
    `Mercury's orbit at ${pxOf(SOLAR.planets[0].orbit).toFixed(0)}px is crowded by the sun's halo at ${halo.toFixed(0)}px`
  )

  for (let i = 0; i < SOLAR.planets.length; i++) {
    const p = SOLAR.planets[i]
    const dot = pxOf(p.size)
    assert.ok(dot >= 1.8, `${p.name} has a radius of only ${dot.toFixed(1)}px`)
    if (i === 0) continue
    const prev = SOLAR.planets[i - 1]
    const gap = pxOf(p.orbit - prev.orbit)
    assert.ok(
      gap > dot + pxOf(prev.size),
      `${prev.name} and ${p.name} are ${gap.toFixed(1)}px apart carrying ${(dot + pxOf(prev.size)).toFixed(1)}px of dot`
    )
  }

  // And Saturn's rings have to be bigger than Saturn or they are a smudge.
  const saturn = SOLAR.planets[5]
  assert.ok(
    pxOf(saturn.size * 2.27) - pxOf(saturn.size) > 3,
    'Saturn has no visible rings'
  )
})

test('the sky is behind everything and dense enough to read', () => {
  assert.ok(finite(SKY.pos))
  assert.ok(finite(SKY.col))
  assert.ok(SKY.col.every((c) => c >= 0 && c <= 1))
  // Outside every stage at its largest, so it never punches through one.
  const biggest = Math.max(...VIEWPORTS.map((vp) => outsideCamera(vp).fit)) * 3.2
  assert.ok(SKY.radius > biggest, `sky at ${SKY.radius} is inside a stage at ${biggest.toFixed(0)}`)
  assert.ok(SKY.pos.length / 3 > 800, 'too few stars to read as a sky')
  // Every star on the shell, or fading it in would reveal a lumpy sphere.
  for (const r of radii(SKY.pos)) {
    assert.ok(Math.abs(r - SKY.radius) < 0.01, `a star at ${r.toFixed(2)} is off the shell`)
  }
})

test('point clouds render at a size you can see', () => {
  // three sizes points by gl_PointSize = size * (height/2) / -z. There is
  // no field of view in it at all, which is the trap: converting with the
  // usual tan(fov/2) is correct for geometry and makes every point cloud
  // out here 2.7 times smaller than asked for. These are the numbers that
  // rule produces from the constants the components actually pass.
  const renders = (worldSize, distance, h) => (worldSize * (h / 2)) / distance

  for (const vp of VIEWPORTS) {
    const view = outsideCamera(vp)
    const pointUnit = view.dist / (vp.h / 2)
    for (const [what, wanted] of [
      ['asteroids', 1.3],
      ['galaxy stars', 1.8],
      ['universe galaxies', 2.0],
    ]) {
      const got = renders(wanted * pointUnit, view.dist, vp.h)
      assert.ok(
        Math.abs(got - wanted) < 0.05,
        `${vp.name}: ${what} asked for ${wanted}px, would render at ${got.toFixed(2)}px`
      )
    }

    // The sky is never scaled by a stage and sits at a fixed radius, so its
    // world size is a bare constant in the component and has to be checked
    // against the rule directly.
    const sky = renders(1.2, SKY.radius, vp.h)
    assert.ok(sky > 1, `${vp.name}: sky stars render at only ${sky.toFixed(2)}px`)
    // And it must stay under the galaxy's stars, or the backdrop reads as
    // the brighter object and the galaxy sits behind its own background.
    assert.ok(sky < 1.8, `${vp.name}: sky stars outshine the galaxy's`)
  }
})

// ---------- the two big ones ----------

test('the galaxy is a disc, not a ball or a cloud of NaN', () => {
  assert.ok(finite(GALAXY.pos))
  assert.ok(finite(GALAXY.col))
  let maxR = 0
  let maxY = 0
  for (let i = 0; i < GALAXY.pos.length; i += 3) {
    maxR = Math.max(maxR, Math.hypot(GALAXY.pos[i], GALAXY.pos[i + 2]))
    maxY = Math.max(maxY, Math.abs(GALAXY.pos[i + 1]))
  }
  assert.ok(maxR < GALAXY.radius * 1.35, `galaxy reached ${maxR.toFixed(2)}`)
  assert.ok(maxY < maxR * 0.25, `thickness ${maxY.toFixed(3)} vs radius ${maxR.toFixed(2)}`)
  assert.ok(GALAXY.col.every((c) => c >= 0 && c <= 1))
  const sunR = Math.hypot(GALAXY.sun[0], GALAXY.sun[2])
  assert.ok(sunR > GALAXY.radius * 0.4 && sunR < GALAXY.radius * 0.8)
})

test('the universe clusters rather than being static', () => {
  assert.ok(finite(UNIVERSE.pos))
  assert.ok(finite(UNIVERSE.web))
  assert.equal(UNIVERSE.web.length % 6, 0)
  assert.ok(UNIVERSE.web.length > 0, 'no cosmic web at all')

  const n = UNIVERSE.pos.length / 3
  let sum = 0
  for (let i = 0; i < n; i++) {
    let best = Infinity
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const dx = UNIVERSE.pos[i * 3] - UNIVERSE.pos[j * 3]
      const dy = UNIVERSE.pos[i * 3 + 1] - UNIVERSE.pos[j * 3 + 1]
      const dz = UNIVERSE.pos[i * 3 + 2] - UNIVERSE.pos[j * 3 + 2]
      best = Math.min(best, dx * dx + dy * dy + dz * dz)
    }
    sum += Math.sqrt(best)
  }
  const mean = sum / n
  const even = UNIVERSE.radius / Math.cbrt(n)
  assert.ok(mean < even * 0.6, `mean spacing ${mean.toFixed(3)} vs even ${even.toFixed(3)}`)
})

console.log('\n' + passed + ' passed')
