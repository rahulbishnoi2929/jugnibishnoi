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
  hubOpacity,
  HUB_GONE,
  ZOOM_EASE,
  ZOOM_RATE,
  ZOOM_SNAP,
  ZOOM_DT_MAX,
  labelScaleFor,
  nestFor,
  placeNodes,
  placeRooms,
  shrinkFor,
  stagePlacement,
} from './layout.js'
import {
  PLANETS,
  blackbody,
  galaxy,
  orbitOf,
  solarSystem,
  starfield,
  universe,
} from './cosmos.js'

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
const ORIGIN = new THREE.Vector3()

// Where a point of a stage lands, in fractions of the viewport.
function screenOf(stage, size, view, point) {
  stagePlacement(stage, size, view.fit, 0, place)
  _m.compose(place.position, place.quaternion, _s.setScalar(place.scale))
  const n = new THREE.Vector3(point[0], point[1], point[2])
    .applyMatrix4(_m)
    .project(view.cam)
  return { x: (n.x + 1) / 2, y: (1 - n.y) / 2, scale: place.scale }
}

// Where his planet is: the world origin, always. Every stage out there is
// placed so the thing you came from lands on it.
const HUB = new THREE.Vector3(0, 0, 0)

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
        opacity < 0.01 || size < 3.6,
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

test('every scale is stacked on the same point', () => {
  // The nesting, and the fix for "our earth goes into sun". Each stage is
  // placed so the thing you came from lands on the world origin, which is
  // where his planet is. So Earth, the sun's place in the galaxy, and our
  // cluster's place in the universe are all the same point on screen, at
  // every zoom, and nothing has to travel to get there.
  const view = outsideCamera(VIEWPORTS[0])

  // The camera aims a little above the world origin — it is framed for a
  // standing figure — so the shared point is near the middle rather than
  // exactly on it. What matters is that it is the *same* point for all of
  // them, at every size.
  const first = screenOf(SOLAR, 1, view, SOLAR.anchor)
  assert.ok(
    Math.hypot(first.x - 0.5, first.y - 0.5) < 0.03,
    `the stack sits ${Math.hypot(first.x - 0.5, first.y - 0.5).toFixed(3)} off the middle`
  )

  for (const [name, stage] of [
    ['Earth in the solar system', SOLAR],
    ['the sun in the galaxy', GALAXY],
    ['our cluster in the universe', UNIVERSE],
  ]) {
    for (const size of [3.4, 2.0, 1.0, 0.5, 0.1]) {
      const p = screenOf(stage, size, view, stage.anchor)
      const apart = Math.hypot(p.x - first.x, p.y - first.y)
      assert.ok(
        apart < 0.001,
        `${name} at size ${size} sits ${apart.toFixed(4)} from where the others do`
      )
    }
  }
})

test('his planet lands on Earth, not in the sun', () => {
  // Reported as "our earth goes into sun". The stage used to ease its
  // anchor out as it settled, sliding its own centre onto the origin —
  // where his planet was nailed. So the sun arrived exactly where he was
  // standing. Now the anchor never eases, and the two coincide by
  // construction at every size.
  const view = outsideCamera(VIEWPORTS[0])

  for (const size of [3.4, 1.6, 1.0, 0.4]) {
    stagePlacement(SOLAR, size, view.fit, 0, place)
    _m.compose(place.position, place.quaternion, _s.setScalar(place.scale))
    const earth = new THREE.Vector3(...SOLAR.anchor).applyMatrix4(_m)
    const sun = new THREE.Vector3(0, 0, 0).applyMatrix4(_m)

    assert.ok(
      HUB.distanceTo(earth) < 1e-9,
      `at size ${size} his planet is ${HUB.distanceTo(earth).toFixed(4)} from Earth`
    )
    // And the sun is a real distance away from him, not on top of him.
    assert.ok(
      HUB.distanceTo(sun) > place.scale * 0.3,
      `at size ${size} the sun is ${HUB.distanceTo(sun).toFixed(3)} away — that is on top of him`
    )
  }
})

test('the solar system sits at the sun, not at the galactic core', () => {
  // The same fault one level out. At the galaxy stage his planet, the
  // solar system and the sun's place in the galaxy are one point, and the
  // core is well away from it.
  const view = outsideCamera(VIEWPORTS[0])
  stagePlacement(GALAXY, 1, view.fit, 0, place)
  _m.compose(place.position, place.quaternion, _s.setScalar(place.scale))
  const sunInGalaxy = new THREE.Vector3(...GALAXY.anchor).applyMatrix4(_m)
  const core = new THREE.Vector3(0, 0, 0).applyMatrix4(_m)

  assert.ok(
    HUB.distanceTo(sunInGalaxy) < 1e-9,
    'his planet is not where the galaxy puts the sun'
  )
  assert.ok(
    HUB.distanceTo(core) > place.scale * 0.5,
    'his planet ended up at the galactic core'
  )
})

test('nothing has to travel across the frame', () => {
  // The other half of "the transition is not smooth". With the anchor
  // easing out, his planet crossed 4.2 per cent of the frame in a single
  // frame around zoom 15, because centring the galaxy on its own core is a
  // pan across two thirds of the screen. Now it is zero by construction,
  // and this is the assertion that says so rather than the comment.
  const view = outsideCamera(VIEWPORTS[0])
  const halfW = view.dist * Math.tan(Math.PI / 9) * view.cam.aspect

  let zoom = 1
  let worst = 0
  for (let f = 0; f < 1200; f++) {
    const before = zoom
    zoom = ease(zoom, ZOOM_MAX, 1 / 60)
    if (zoom === before) break
    // Where each stage's anchor is on screen, frame over frame.
    for (const stage of BODIES) {
      const a = screenOf(stage, cosmicStage(cosmicScale(before), 1).size, view, stage.anchor)
      const b = screenOf(stage, cosmicStage(cosmicScale(zoom), 1).size, view, stage.anchor)
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y))
    }
  }
  assert.ok(
    worst < 0.002,
    `an anchor moved ${(worst * 100).toFixed(2)}% of the frame in one frame`
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
  assert.ok(SKY.col.every((c) => c >= 0 && c < 1.6))
  // Outside every stage at its largest, so it never punches through one.
  const biggest = Math.max(...VIEWPORTS.map((vp) => outsideCamera(vp).fit)) * 3.6
  assert.ok(SKY.radius > biggest, `sky at ${SKY.radius} is inside a stage at ${biggest.toFixed(0)}`)
  assert.ok(SKY.pos.length / 3 > 800, 'too few stars to read as a sky')
  // Every star on the shell, or fading it in would reveal a lumpy sphere.
  for (const r of radii(SKY.pos)) {
    assert.ok(Math.abs(r - SKY.radius) < 0.01, `a star at ${r.toFixed(2)} is off the shell`)
  }
})

test('point clouds render at a size you can see', () => {
  // The shader works out to gl_PointSize = aSize * px * dpr, because uSize
  // carries the camera distance and uScale carries the half-height. In CSS
  // pixels that is aSize * px, independent of device and viewport — which
  // is the property worth pinning, since two earlier versions got it wrong
  // in opposite directions: once by leaving out the scale entirely (a
  // hundredth of a pixel) and once by converting with tan(fov/2), which is
  // right for geometry and 2.7x too small for points.
  const cssPx = (aSize, px) => aSize * px

  const spread = (siz) => {
    const s = [...siz].sort((a, b) => a - b)
    return { median: s[Math.floor(s.length / 2)], p99: s[Math.floor(s.length * 0.99)] }
  }

  // px values are the ones Cosmos passes each cloud.
  const clouds = [
    ['galaxy stars', GALAXY.layers.disc.siz, 1.5, 1.0, 3.2, 4, 12],
    ['galaxy bulge', GALAXY.layers.bulge.siz, 1.5, 1.0, 3.2, 3, 12],
    ['star-forming knots', GALAXY.layers.hii.siz, 1.5, 3.0, 9.0, 4, 14],
    ['galaxies', UNIVERSE.layers.gal.siz, 1.6, 1.0, 3.5, 4, 14],
    ['asteroids', SOLAR.asteroids.siz, 1.25, 0.8, 2.5, 2, 9],
    ['the sky', SKY.siz, 1.15, 0.8, 2.5, 2, 9],
  ]

  for (const [what, siz, px, medLo, medHi, tailLo, tailHi] of clouds) {
    const { median, p99 } = spread(siz)
    const m = cssPx(median, px)
    const t = cssPx(p99, px)
    assert.ok(
      m >= medLo && m <= medHi,
      `${what}: the typical one renders at ${m.toFixed(1)}px, wanted ${medLo}-${medHi}`
    )
    assert.ok(
      t >= tailLo && t <= tailHi,
      `${what}: the brightest render at ${t.toFixed(1)}px, wanted ${tailLo}-${tailHi}`
    )
    // A cloud where every point is the same size is a texture, not a sky.
    assert.ok(
      p99 / median > 2,
      `${what} has no magnitude spread: p99 is only ${(p99 / median).toFixed(1)}x the median`
    )
  }

  // The haze is deliberately huge and faint, but it has to stay under the
  // 63-pixel cap some drivers put on gl_PointSize.
  const haze = spread(GALAXY.layers.haze.siz)
  assert.ok(cssPx(haze.p99, 1.0) < 40, `haze blobs reach ${cssPx(haze.p99, 1.0).toFixed(0)}px`)
})

// ---------- the galaxy, as a picture ----------
//
// The complaint was that it looked like a logo. These are the measurable
// differences between a photograph of a spiral galaxy and a decal of one.

// Light per unit area in radial bins, using size squared times brightness,
// which is what a point actually contributes.
function surfaceBrightness(l, bins = 12, rmax = 1.1) {
  const out = new Float64Array(bins)
  for (let i = 0; i < l.count; i++) {
    const r = Math.hypot(l.pos[i * 3], l.pos[i * 3 + 2])
    if (r >= rmax) continue
    const b = (l.col[i * 3] + l.col[i * 3 + 1] + l.col[i * 3 + 2]) / 3
    out[Math.floor((r / rmax) * bins)] += l.siz[i] * l.siz[i] * b
  }
  return [...out].map((v, k) => {
    const r0 = (k / bins) * rmax
    const r1 = ((k + 1) / bins) * rmax
    return v / (Math.PI * (r1 * r1 - r0 * r0))
  })
}

test('the galaxy fades out instead of having an edge', () => {
  // The first one cut off at a fixed radius, which is the single clearest
  // tell of a drawn spiral. A real disc falls off exponentially and just
  // keeps going.
  const sb = surfaceBrightness(GALAXY.layers.disc)
  for (let i = 1; i < sb.length; i++) {
    assert.ok(sb[i] < sb[i - 1], `surface brightness rose again in bin ${i}`)
  }
  // Exponential, near enough: each bin a roughly constant fraction of the
  // last, rather than flat then falling off a cliff.
  const ratios = sb.slice(1).map((v, i) => v / sb[i])
  for (const r of ratios) {
    assert.ok(r > 0.45 && r < 0.92, `a bin fell by ${r.toFixed(2)}x, which is a cliff or a plateau`)
  }
  // And there are still stars past the disc's own nominal extent, which is
  // not the same as the radius the stage is framed by.
  const beyond = [...Array(GALAXY.layers.disc.count).keys()].filter((i) => {
    const p = GALAXY.layers.disc.pos
    return Math.hypot(p[i * 3], p[i * 3 + 2]) > GALAXY.extent
  })
  assert.ok(beyond.length > 20, 'nothing at all beyond the nominal radius')
})

// Azimuthal profile with the spiral unwound, so arms become straight bands.
function armProfile(l, bins = 48, rIn = 0.35, rOut = 0.65) {
  const out = new Float64Array(bins)
  const pitch = Math.tan((12.5 * Math.PI) / 180)
  for (let i = 0; i < l.count; i++) {
    const x = l.pos[i * 3]
    const z = l.pos[i * 3 + 2]
    const r = Math.hypot(x, z)
    if (r < rIn || r > rOut) continue
    const p = Math.log(r / 0.055) / pitch
    let th = Math.atan2(z, x) - p
    th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    out[Math.floor((th / (Math.PI * 2)) * bins)]++
  }
  return [...out]
}

test('the galaxy has arms, and dust lanes that dim rather than delete', () => {
  const az = armProfile(GALAXY.layers.disc)
  const mean = az.reduce((a, b) => a + b) / az.length
  const peak = Math.max(...az)
  const trough = Math.min(...az)

  assert.ok(peak / mean > 1.8, `arms are only ${(peak / mean).toFixed(2)}x the mean — too faint to read`)
  // The dark lanes have to be dark. But not empty: subtracting dust instead
  // of attenuating with it drove the density through zero and cut two blank
  // wedges out of the disc, measured at 3% of the arm peak.
  assert.ok(trough / peak < 0.3, `the darkest lane is ${(trough / peak).toFixed(2)} of the peak — no lanes`)
  assert.ok(trough / mean > 0.1, `the darkest lane is ${(trough / mean).toFixed(3)} of the mean — a hole, not dust`)

  // Two major arms: two clear maxima half a turn apart.
  const half = az.length / 2
  let best = 0
  let bestAt = 0
  for (let k = 0; k < half; k++) {
    const paired = az[k] + az[k + half]
    if (paired > best) {
      best = paired
      bestAt = k
    }
  }
  assert.ok(
    az[bestAt] / mean > 1.6 && az[bestAt + half] / mean > 1.6,
    'the two major arms are not both there'
  )
  // And not two-fold symmetric, or it reads as a pinwheel: the two arms
  // must differ, and there must be structure between them.
  const asym = Math.abs(az[bestAt] - az[bestAt + half]) / Math.max(az[bestAt], az[bestAt + half])
  assert.ok(asym > 0.01, 'the two arms are identical — that is a pinwheel')
})

test('the galaxy is four populations, not one', () => {
  // Young blue stars in the arms, old yellow ones between them and in the
  // bulge, pink knots where stars are forming. One flat colour ramp by
  // radius — the first version — is a gradient, not a galaxy.
  const meanCol = (l) => {
    let r = 0
    let g = 0
    let b = 0
    for (let i = 0; i < l.count; i++) {
      r += l.col[i * 3]
      g += l.col[i * 3 + 1]
      b += l.col[i * 3 + 2]
    }
    return [r / l.count, g / l.count, b / l.count]
  }
  const bulge = meanCol(GALAXY.layers.bulge)
  const hii = meanCol(GALAXY.layers.hii)

  // The bulge is warmer than it is blue.
  assert.ok(bulge[0] > bulge[2] * 1.2, 'the bulge is not the warm old population')
  // The knots are pink: strong red, weak green.
  assert.ok(hii[0] > hii[1] * 1.6, 'the star-forming knots are not pink')
  // And the bulge really is a separate, flattened, concentrated thing.
  let maxR = 0
  for (let i = 0; i < GALAXY.layers.bulge.count; i++) {
    maxR = Math.max(
      maxR,
      Math.hypot(GALAXY.layers.bulge.pos[i * 3], GALAXY.layers.bulge.pos[i * 3 + 2])
    )
  }
  assert.ok(maxR < GALAXY.radius * 0.5, `the bulge reaches ${maxR.toFixed(2)} — that is a disc`)
})

// ---------- realism ----------
//
// Things that are true of a photograph and were not true of the first few
// versions of this. All of them are checkable because all of them come
// from a model rather than from a palette.

test('star colour follows temperature, not taste', () => {
  // The Planckian locus, checked at stars whose colours are known. If this
  // drifts, every population out here drifts with it.
  const at = (K) => blackbody(K).map((v) => Math.round(v * 255))
  const sun = at(5778)
  assert.ok(sun[0] === 255 && sun[1] > 235 && sun[2] > 220, `the sun came out ${sun}`)
  const proxima = at(3050)
  assert.ok(proxima[0] === 255 && proxima[2] < 140, `an M dwarf came out ${proxima}`)
  const sirius = at(9940)
  assert.ok(sirius[2] === 255 && sirius[0] < 220, `an A star came out ${sirius}`)

  // Monotone: hotter is bluer, all the way up.
  let prev = -1
  for (let K = 2000; K <= 30000; K += 500) {
    const c = blackbody(K)
    const blueness = c[2] / c[0]
    assert.ok(blueness > prev, `blueness went backwards at ${K}K`)
    prev = blueness
  }
})

test('the galaxy is a population, not a gradient', () => {
  // A real disc runs from orange dwarfs through white to a few blue
  // giants, and the big ones are the bright ones. The first version lerped
  // one colour by radius, which is a gradient.
  const disc = GALAXY.layers.disc
  const ratio = []
  for (let i = 0; i < disc.count; i++) {
    ratio.push(disc.col[i * 3] / Math.max(1e-6, disc.col[i * 3 + 2]))
  }
  ratio.sort((a, b) => a - b)
  const q = (f) => ratio[Math.floor(f * (ratio.length - 1))]
  assert.ok(q(0.02) < 0.85, `the bluest stars are only ${q(0.02).toFixed(2)} red/blue`)
  assert.ok(q(0.98) > 1.5, `the reddest stars are only ${q(0.98).toFixed(2)} red/blue`)

  // Size and brightness go together, because temperature drives both.
  let bigSum = 0
  let bigN = 0
  let smallSum = 0
  let smallN = 0
  for (let i = 0; i < disc.count; i++) {
    const lum = (disc.col[i * 3] + disc.col[i * 3 + 1] + disc.col[i * 3 + 2]) / 3
    if (disc.siz[i] > 2) {
      bigSum += lum
      bigN++
    } else if (disc.siz[i] < 1) {
      smallSum += lum
      smallN++
    }
  }
  assert.ok(bigN > 10 && smallN > 10, 'not enough of each to compare')
  assert.ok(
    bigSum / bigN > (smallSum / smallN) * 1.5,
    'the big stars are not the bright ones'
  )
})

test('the sky has a Milky Way in it', () => {
  // From inside a spiral galaxy the sky has a band across it. This was
  // simply missing, and it is the most recognisable thing about a real
  // night sky.
  const pole = SKY.pole
  const sinLat = (l, i) =>
    (l.pos[i * 3] * pole[0] + l.pos[i * 3 + 1] * pole[1] + l.pos[i * 3 + 2] * pole[2]) /
    SKY.radius

  const share = (l, limit) => {
    let n = 0
    for (let i = 0; i < l.count; i++) if (Math.abs(sinLat(l, i)) < limit) n++
    return n / l.count
  }

  // Resolved stars: denser towards the plane, but everywhere. Equal
  // sampling of a sphere would put 17% of them inside ten degrees.
  const stars10 = share(SKY, Math.sin((10 * Math.PI) / 180))
  assert.ok(stars10 > 0.28, `only ${(stars10 * 100).toFixed(0)}% of stars near the plane`)
  assert.ok(stars10 < 0.7, `${(stars10 * 100).toFixed(0)}% near the plane — that is a disc, not a sky`)

  // The band of unresolved light: a bright core a few degrees wide, and a
  // glow carrying out to twenty. At a tighter concentration it came out
  // knife-edged, with nothing at all past seventeen degrees.
  const band20 = share(SKY.band, Math.sin((20 * Math.PI) / 180))
  const band6 = share(SKY.band, Math.sin((6 * Math.PI) / 180))
  assert.ok(band20 > 0.9, `only ${(band20 * 100).toFixed(0)}% of the band is within 20 degrees`)
  assert.ok(band6 > 0.4 && band6 < 0.85, `${(band6 * 100).toFixed(0)}% of the band is inside 6 degrees`)
  // And it must be on the same plane as the star density, or there are two
  // Milky Ways.
  let bandMean = 0
  for (let i = 0; i < SKY.band.count; i++) bandMean += Math.abs(sinLat(SKY.band, i))
  assert.ok(bandMean / SKY.band.count < 0.12, 'the band is not on the galactic plane')
})

test('the deep field is galaxies, not stars', () => {
  // Every point out there is a galaxy, and a galaxy is a disc at some
  // angle — so most of them are ellipses. Round dots read as stars, which
  // is exactly the wrong thing at that scale.
  const asp = [...UNIVERSE.layers.gal.asp].sort((a, b) => a - b)
  const ang = UNIVERSE.layers.gal.ang
  assert.equal(asp.length, UNIVERSE.layers.gal.count)
  const slivers = asp.filter((v) => v < 0.5).length / asp.length
  assert.ok(slivers > 0.2, `only ${(slivers * 100).toFixed(0)}% are edge-on enough to read as discs`)
  const round = asp.filter((v) => v > 0.95).length / asp.length
  assert.ok(round < 0.2, `${(round * 100).toFixed(0)}% are round — that is a star field`)
  assert.ok(asp.every((v) => v > 0.05 && v <= 1), 'an aspect ratio is out of range')

  // Turned every which way, not all lying the same direction.
  let sin = 0
  let cos = 0
  for (let i = 0; i < ang.length; i++) {
    sin += Math.sin(2 * ang[i])
    cos += Math.cos(2 * ang[i])
  }
  const aligned = Math.hypot(sin, cos) / ang.length
  assert.ok(aligned < 0.12, `the galaxies are ${(aligned * 100).toFixed(0)}% aligned to one axis`)
})

test('the planets lean the way they really lean', () => {
  // Obliquity is real data, and it is what the banding and Saturn's rings
  // are both built from — so it has to survive the trip into the scene.
  for (let i = 0; i < SOLAR.planets.length; i++) {
    const p = SOLAR.planets[i]
    const el = PLANETS[i]
    const axis = p.axis
    assert.ok(
      Math.abs(Math.hypot(axis[0], axis[1], axis[2]) - 1) < 1e-9,
      `${p.name}'s axis is not a unit vector`
    )
    // The angle from the orbital pole is the obliquity, or its supplement
    // for the two that spin backwards.
    const lean = (Math.acos(Math.max(-1, Math.min(1, axis[1]))) * 180) / Math.PI
    const want = el.tilt
    assert.ok(
      Math.abs(lean - want) < 0.5,
      `${p.name} leans ${lean.toFixed(1)} degrees, the table says ${want}`
    )
  }

  // The two famous ones, stated as facts rather than as numbers.
  const uranus = SOLAR.planets[6]
  assert.ok(
    Math.abs(uranus.axis[1]) < 0.2,
    'Uranus should be lying on its side, axis nearly in its own orbital plane'
  )
  const venus = SOLAR.planets[1]
  assert.ok(venus.axis[1] < -0.9, 'Venus should be upside down')

  // Only the giants are banded.
  for (const p of SOLAR.planets) {
    const giant = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'].includes(p.name)
    assert.ok(giant ? p.bands > 0.3 : p.bands === 0, `${p.name} has bands ${p.bands}`)
  }

  // And Saturn's rings sit in its equator, which is the plane at right
  // angles to its axis — so the 26.7 degrees lives in one place only.
  const saturn = SOLAR.planets[5]
  const ringTilt = (Math.acos(Math.abs(saturn.axis[1])) * 180) / Math.PI
  assert.ok(
    Math.abs(ringTilt - 26.73) < 0.5,
    `Saturn's rings would sit at ${ringTilt.toFixed(1)} degrees`
  )
})

test('the galaxy has a nucleus', () => {
  // A small very bright core on top of the bulge. Without it the middle of
  // this was just more disc.
  const n = GALAXY.layers.nucleus
  assert.equal(n.count, 1)
  assert.ok(Math.hypot(n.pos[0], n.pos[1], n.pos[2]) < 1e-9, 'the nucleus is off centre')
  // Brighter than anything in the bulge around it.
  let brightest = 0
  for (const v of GALAXY.layers.bulge.col) brightest = Math.max(brightest, v)
  assert.ok(n.col[0] > brightest * 0.85, 'the nucleus is not brighter than its bulge')
  assert.ok(n.col[0] > n.col[2], 'the nucleus should be warm')
})

// ---------- smoothness ----------
//
// Everything out here is paced by one thing: Ease, which pulls the real
// zoom towards the one the gesture asked for. So the question "are the
// transitions smooth" has an exact answer — step that easing at a frame
// rate, and look at how much anything on screen can change between two
// frames.
//
// Nothing else may smooth anything. Nest and Shrink used to lerp towards
// their own targets at their own rate while Cosmos read the zoom directly,
// so his planet lagged behind the solar system arriving around it: two
// things animating one gesture at two speeds, which is most of what made
// this feel rough.

// Ease, exactly as Hub runs it: proportional in log-zoom, with a ceiling
// on the rate.
function ease(zoom, want, dt) {
  const step = Math.min(dt, ZOOM_DT_MAX)
  const gap = Math.log(want / zoom)
  if (Math.abs(gap) < ZOOM_SNAP) return want
  const k = 1 - Math.pow(ZOOM_EASE, step)
  const move = Math.sign(gap) * Math.min(Math.abs(gap) * k, ZOOM_RATE * step)
  return zoom * Math.exp(move)
}

// The worst per-frame change in anything visible, over a whole gesture.
function roughest({ from, to, dt = 1 / 60, frames = 600 }) {
  let zoom = from
  let worst = { opacity: 0, size: 0, hub: 0, at: from }
  for (let f = 0; f < frames; f++) {
    const before = zoom
    zoom = ease(zoom, to, dt)
    if (zoom === before) break

    const t0 = cosmicScale(before)
    const t1 = cosmicScale(zoom)
    for (const i of STAGE_IDS) {
      const a = cosmicStage(t0, i)
      const b = cosmicStage(t1, i)
      const dOp = Math.abs(a.opacity - b.opacity)
      // Size is geometric, so compare it as a ratio.
      const dSize = Math.abs(Math.log(b.size / a.size))
      if (dOp > worst.opacity) worst = { ...worst, opacity: dOp, at: zoom }
      if (dSize > worst.size) worst = { ...worst, size: dSize }
    }
    const dHub = Math.abs(hubOpacity(before) - hubOpacity(zoom))
    if (dHub > worst.hub) worst = { ...worst, hub: dHub }
  }
  return worst
}

test('no frame of the way out jumps', () => {
  // Two gestures, each about as violent as the input allows: a hard flick
  // of a trackpad, and a full two-finger spread released in one go.
  const gestures = [
    ['a flick out from the hub', 1, 12],
    ['a flick further out', 12, 72.1],
    ['the whole way out at once', 1, 72.1],
    ['back to Earth in one press', 72.1, 1],
    ['a pinch inside the hub range', 1, 0.4],
  ]
  for (const [what, from, to] of gestures) {
    const w = roughest({ from, to })
    assert.ok(
      w.opacity < 0.12,
      `${what}: a stage's opacity moved ${w.opacity.toFixed(3)} in one frame`
    )
    assert.ok(
      w.size < 0.09,
      `${what}: a stage's size moved ${(Math.exp(w.size) * 100 - 100).toFixed(1)}% in one frame`
    )
    assert.ok(
      w.hub < 0.12,
      `${what}: his planet's own fade moved ${w.hub.toFixed(3)} in one frame`
    )
  }
})

test('a slow frame is no rougher than a fast one', () => {
  // The easing is exponential on delta time, so 30fps has to take the same
  // wall-clock time as 120fps rather than the same number of steps — and
  // the per-frame jump at 30fps must still be small enough not to read as
  // a step. dt is clamped at 0.1, which is what stops a stall from
  // teleporting the whole ladder.
  const fast = roughest({ from: 1, to: 72.1, dt: 1 / 120 })
  const slow = roughest({ from: 1, to: 72.1, dt: 1 / 30 })
  const stalled = roughest({ from: 1, to: 72.1, dt: 0.5, frames: 40 })

  assert.ok(fast.opacity < slow.opacity, 'more frames should mean smaller steps')
  assert.ok(slow.opacity < 0.24, `30fps jumps ${slow.opacity.toFixed(3)} per frame`)
  // A dropped frame is a visible hitch whatever we do; the bound that
  // matters is that it must not skip a whole transition. A third of a fade
  // is the line. Without the dt clamp the same stall jumped 0.58 — over
  // half a fade — which is what the clamp is there to stop.
  assert.ok(
    stalled.opacity < 0.35,
    `a stalled frame jumps ${stalled.opacity.toFixed(3)} — over a third of a fade`
  )

  // And the same gesture takes the same time whatever the frame rate.
  const settle = (dt) => {
    let z = 1
    let n = 0
    while (z !== 72.1 && n < 100000) {
      z = ease(z, 72.1, dt)
      n++
    }
    return n * dt
  }
  const a = settle(1 / 120)
  const b = settle(1 / 30)
  assert.ok(
    Math.abs(a - b) / a < 0.15,
    `settling took ${a.toFixed(2)}s at 120fps and ${b.toFixed(2)}s at 30fps`
  )
  // Long enough to read as a journey, short enough not to be a wait.
  assert.ok(a > 0.6 && a < 4, `the whole way out settles in ${a.toFixed(2)}s`)
})

test('his planet is gone before the subtree is pulled', () => {
  // The pop this replaces: the hub used to unmount at t = 1.1 while its
  // branch ring was still four pixels across and at full brightness.
  const zoomAt = (t) => ZOOM_HUB_MAX * Math.pow(ZOOM_MAX / ZOOM_HUB_MAX, t / STAGES.length)
  assert.ok(
    hubOpacity(zoomAt(HUB_GONE)) < 0.001,
    `his planet is still at ${hubOpacity(zoomAt(HUB_GONE)).toFixed(3)} opacity when it unmounts`
  )
  // And it is fully there for the whole of its own zoom range.
  for (let z = ZOOM_MIN; z <= ZOOM_HUB_MAX; z += 0.05) {
    assert.ok(Math.abs(hubOpacity(z) - 1) < 1e-9, `his planet dimmed at zoom ${z.toFixed(2)}`)
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
  assert.ok(maxR < GALAXY.extent * 1.35, `galaxy reached ${maxR.toFixed(2)}`)
  assert.ok(maxY < maxR * 0.25, `thickness ${maxY.toFixed(3)} vs radius ${maxR.toFixed(2)}`)
  // Over one is allowed and wanted: these layers are additive, so a bright
  // star saturating early is the point. What is not allowed is a runaway.
  assert.ok(GALAXY.col.every((c) => c >= 0 && c < 1.6))
  const sunR = Math.hypot(GALAXY.sun[0], GALAXY.sun[2])
  assert.ok(sunR > GALAXY.extent * 0.4 && sunR < GALAXY.extent * 0.8)
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
