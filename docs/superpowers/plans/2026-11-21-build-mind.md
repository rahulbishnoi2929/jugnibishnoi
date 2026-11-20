# Build: Inside My Head — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping Build replaces the hub with a procedural, transparent point-cloud skull. Neuron pulses run through it and Rahul's projects drift inside. Tapping a project opens its details.

**Architecture:** A pure, seeded generator (`client/src/mind/mind.js`, the same idiom as `hub/cosmos.js`) produces the skull surface points, the neuron polylines and the project loops as plain arrays, tested under node. `Mind.jsx` draws them in the existing hub `<Canvas>`: skull points through `starMaterial`, neurons as one line mesh with a time-driven pulse shader, and projects as bright points with drei `Html` labels. `Hub.jsx` lazy-loads `Mind` when `active === 'build'`, hides the hub, frames the camera with a new `mindView()`, and routes `/c/build/<project>` to a project panel.

**Tech Stack:** React 18, @react-three/fiber 8, @react-three/drei 9, three 0.169, node `assert` tests (no framework).

**Spec:** `docs/superpowers/specs/2026-11-21-build-mind-design.md`

## Global Constraints

- Procedural only: no model files, no textures, no new dependencies.
- Seeded and deterministic: the same seed gives the same head (use the `rng` mulberry32 copied from `cosmos.js`).
- Projects come from `work.js` `featured` only. Today that is Zamindara and Rights, never anything in `also`.
- Neuron colour is Build's accent `#3DDC97`. Projects use a warm contrast colour (`#ffb547`).
- `Mind` is lazy-loaded: nothing from `client/src/mind/` may be in the hub's initial chunk.
- Phones (`narrow`) get fewer points: skull 2 500 vs 6 000, neuron seeds 10 vs 18.
- Respect `prefers-reduced-motion`: no camera tween (snap), no auto-spin, pulses still run but slower.
- Code style: single quotes, no semicolons, 100 columns, comments that explain why (match `cosmos.js`).

## Review Focus

1. **Deep link straight to `/c/build` or `/c/build/rights` on first load.** The skull should appear without playing the hub-vanish first, and the panel should open for the project. Covered in Task 4, step 6 (manual check).
2. **An unknown project id (`/c/build/nope`)** should show the skull with no panel and no crash. Covered by `projectFor` returning `null` (Task 4 test).
3. **Leaving Build mid-transition** (tapping back within 0.6 s) should bring the hub back with its labels. The vanish timer has to be cancelled. Covered in Task 4, step 6.
4. **Projects on a phone:** two labels must not overlap at any time, and must be big enough to tap. Covered by the minimum-separation test in Task 2.
5. **NaN in generated arrays** would draw an invisible head. Covered by the finite-values assertions in Tasks 1–2.

---

### Task 1: The skull generator

**Files:**
- Create: `client/src/mind/mind.js`
- Create: `client/src/mind/mind.test.mjs`
- Modify: `package.json`: append `&& node client/src/mind/mind.test.mjs` to `scripts.test`

**Interfaces:**
- Produces: `skullSdf(p: [x,y,z]) -> number` (negative inside), `skull({ seed = 11, count = 6000 }) -> { pos: Float32Array(count*3), size: Float32Array(count), radius: 1 }`, and `rng(seed)` (exported for Task 2). Units: the whole skull fits inside a sphere of radius 1 around the origin. y is up and the face points +z.

- [ ] **Step 1: Write the failing tests** in `mind.test.mjs` (same `test()` harness as `game/clock.test.mjs`):

```js
test('skull: right count, all finite, inside the unit sphere', () => {
  const s = skull({ count: 3000 })
  assert.equal(s.pos.length, 9000)
  for (let i = 0; i < 3000; i++) {
    const [x, y, z] = [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]]
    assert.ok(Number.isFinite(x + y + z))
    assert.ok(Math.hypot(x, y, z) <= 1.0001)
  }
})
test('skull: points sit on the surface', () => {
  const s = skull({ count: 2000 })
  for (let i = 0; i < 2000; i++) {
    const p = [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]]
    assert.ok(Math.abs(skullSdf(p)) < 0.02)
  }
})
test('skull: has eye sockets — the socket centres are outside the bone', () => {
  assert.ok(skullSdf([0.2, -0.05, 0.6]) > 0)
  assert.ok(skullSdf([-0.2, -0.05, 0.6]) > 0)
  assert.ok(skullSdf([0, 0.15, -0.05]) < 0, 'middle of the cranium is inside')
})
test('skull: same seed, same head', () => {
  assert.deepEqual(skull({ seed: 3, count: 500 }).pos, skull({ seed: 3, count: 500 }).pos)
})
```

- [ ] **Step 2: Run** `node client/src/mind/mind.test.mjs`. Expected: it fails to import `./mind.js`.

- [ ] **Step 3: Implement `skullSdf` and `skull`.** The SDF is a composition of ellipsoids. Use `ell(p, c, r) = (len((p-c)/r) - 1) * min(r)` and polynomial smooth-min `smin(a, b, k)`. Starting proportions, tuned by eye later:

| part | op | centre | radii |
|---|---|---|---|
| cranium | base | (0, 0.15, -0.05) | (0.62, 0.60, 0.72) |
| face | smin k=0.15 | (0, -0.2, 0.28) | (0.45, 0.42, 0.42) |
| cheekbones ×2 | smin k=0.08 | (±0.38, -0.15, 0.30) | (0.16, 0.10, 0.18) |
| jaw | smin k=0.10 | (0, -0.55, 0.22) | (0.36, 0.20, 0.36) |
| eye sockets ×2 | subtract | (±0.2, -0.05, 0.62) | (0.15, 0.15, 0.15) |
| nasal opening | subtract | (0, -0.28, 0.64) | (0.07, 0.10, 0.10) |

Sampling: draw a uniform point in the box [-1, 1]³, then take up to 6 Newton steps `p -= d * grad` (central differences, h = 1e-3). Keep the point if `|d| < 0.01` and `|p| <= 1`. Repeat until `count` points are kept. Bias toward the rims: if a kept point is within 0.04 of a subtracted shape's boundary, emit it twice (jittered 0.005). That is what makes sockets and the nose read. Teeth: reserve 4% of `count` for points on 14 small clusters along the arc `x = 0.3 sin(a), z = 0.22 + 0.3 cos(a), y = -0.42`, `a ∈ [-0.9, 0.9]`, each with a gaussian of 0.015, then projected onto the surface. Size: `0.6 + 0.8 * rand()`. If the SDF changes a proportion, rescale so the max radius is ≤ 1.

- [ ] **Step 4: Run the tests.** Expected: 4 passed.

- [ ] **Step 5: Commit** with the message `The skull, as a cloud of points on a distance field`.

### Task 2: Neurons and project loops

**Files:**
- Modify: `client/src/mind/mind.js`
- Modify: `client/src/mind/mind.test.mjs`

**Interfaces:**
- Consumes: `rng` from Task 1.
- Produces:
  - `BRAIN = { c: [0, 0.18, -0.05], r: [0.5, 0.46, 0.58] }`
  - `inBrain(p) -> boolean`
  - `neurons({ seed = 5, seeds = 18 }) -> { pos: Float32Array, along: Float32Array, phase: Float32Array }`. These are line *segments* (two vertices per segment, as `THREE.LineSegments` expects). `along` is 0 at a branch's root and 1 at its tip. `phase` is constant per branch, in [0, 1).
  - `loops(n, { seed = 9 }) -> Array<{ c, r, tilt, spin, offset }>` and `loopAt(loop, t) -> [x,y,z]`, where t is in loop turns and position is periodic with period 1.

- [ ] **Step 1: Write the failing tests:**

```js
test('neurons: every vertex finite and inside the brain', () => {
  const n = neurons({ seeds: 10 })
  assert.ok(n.pos.length > 600, 'enough to look like a brain')
  assert.equal(n.pos.length / 3, n.along.length)
  for (let i = 0; i < n.pos.length; i += 3) {
    const p = [n.pos[i], n.pos[i + 1], n.pos[i + 2]]
    assert.ok(Number.isFinite(p[0] + p[1] + p[2]))
    assert.ok(inBrain(p))
  }
  for (const a of n.along) assert.ok(a >= 0 && a <= 1)
})
test('loops: closed, inside the brain, never touching each other', () => {
  for (const count of [2, 3]) {
    const ls = loops(count, {})
    for (const l of ls) assert.deepEqual(loopAt(l, 0).map((v) => v.toFixed(6)), loopAt(l, 1).map((v) => v.toFixed(6)))
    for (let t = 0; t < 1; t += 0.01) {
      const at = ls.map((l) => loopAt(l, t))
      for (const p of at) assert.ok(inBrain(p))
      for (let i = 0; i < at.length; i++)
        for (let j = i + 1; j < at.length; j++)
          assert.ok(Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1], at[i][2] - at[j][2]) > 0.25)
    }
  }
})
```

- [ ] **Step 2: Run.** Expected: FAIL, `neurons is not a function`.

- [ ] **Step 3: Implement.** For neurons, use a random walk from `seeds` roots, uniform in a BRAIN scaled to 0.8. Step 0.035, direction persistence 0.85 plus a gaussian turn. A step that would leave the brain reflects its direction instead. Each step forks with probability 0.07, up to depth 3. A branch has 18–40 steps, with children half as long. For loops, project i has centre `0.18 * (cos θi, 0.4 sin θi, sin θi)` with `θi = 2πi/n`, radius 0.16, a random tilt, and every loop shares the same `spin` of 0.04 turns/s. Phase offsets of `i/n` keep them apart. Tune until the separation test passes.

- [ ] **Step 4: Run the tests.** Expected: 6 passed.

- [ ] **Step 5: Commit** with the message `Neurons that branch, and paths for the projects to travel`.

### Task 3: Drawing the mind

**Files:**
- Create: `client/src/mind/Mind.jsx`
- Create: `client/src/mind/mind.css`

**Interfaces:**
- Consumes: `skull`, `neurons`, `loops`, `loopAt` (Tasks 1–2). `starMaterial` and `tuneStars` come from `../hub/shaders.js`. `featured` comes from `../content/work.js`.
- Produces: `export default function Mind({ narrow, picked, onPick, at })`. `at` is a `THREE.Vector3` world centre and `picked` is a project id or null. Calls `onPick(id)`. Also `export const projectId = (p) => p.title.toLowerCase()`.

- [ ] **Step 1: Implement `Mind`:**
  - **Group:** placed at `at`, scaled by `MIND_SCALE` (exported from layout, Task 4). It fades and scales from 0 to 1 over 0.6 s on mount; read reduced motion the way `Hub.jsx` does.
  - **Skull:** `THREE.Points` with `starMaterial()`. `userData.px = 1.4` and colour `#bfe9d6` at 0.35 brightness. Call `tuneStars` each frame the way `Cosmos.jsx` does (dist = camera to `at`).
  - **Neurons:** `THREE.LineSegments`. Attributes are `position`, `aAlong` and `aPhase`, with a `ShaderMaterial` (additive, `depthWrite: false`). Its fragment is `base 0.12 + pulse` with `pulse = smoothstep(0.06, 0, abs(fract(uTime * 0.35 + aPhase) - aAlong))`, coloured `#3DDC97`. `uTime` advances in `useFrame` (×0.3 under reduced motion).
  - **Projects:** for each `featured` project, a bright point (`starMaterial`, `#ffb547`, px 9) at `loopAt(loop, t)`, where t advances by `spin * dt`. It runs at ×0.15 while that project is hovered, and freezes when `picked` matches it. Each gets a drei `<Html center>` label: a `<button className="mind-project">` with the title, an `aria-label` of `Open <title>`, `onClick={() => onPick(projectId(p))}`, and hover handlers.
  - **Spin:** the group turns at 0.06 rad/s (none under reduced motion), plus horizontal drag. Keep a `start = drag.current.x` on mount and add `drag.current.x - start`. Pass `drag` in as a prop if `Hub`'s `onMove` still updates it while a chapter is active. If it doesn't, attach pointer handlers to an invisible sphere of radius 1.05 instead.
  - Dispose of geometries and materials on unmount (`hub/dispose.js`).

- [ ] **Step 2:** In `mind.css`, style `.mind-project` as a pill: mono font, `#ffb547` border, dark translucent background, 44 px minimum height so it's tappable, with a hover/focus state.

- [ ] **Step 3:** Run `npx eslint client/src/mind` and confirm there's no output.

- [ ] **Step 4: Commit** with the message `The head, drawn: bone as light, neurons that fire, work drifting through`.

### Task 4: Into the head — hub wiring, content, framing

**Files:**
- Modify: `client/src/hub/layout.js` (add `MIND_SCALE` and `mindView`)
- Modify: `client/src/hub/layout.test.mjs` (add a framing test)
- Modify: `client/src/hub/Hub.jsx`
- Modify: `client/src/content/chapters.json` (`build` chapter)
- Create: `client/src/mind/projects.js`
- Test: append to `client/src/mind/mind.test.mjs`

**Interfaces:**
- Consumes: `Mind`, `projectId` (Task 3).
- Produces:
  - `mindView(narrow) -> { pos: Vector3, look: Vector3 }`, the same shape as `branchView`.
  - `MIND_SCALE(narrow) -> number`.
  - `projectFor(id) -> chapter-shaped object | null` in `projects.js`. The shape is `{ id, title, lede: blurb, body: [body, problem], artifacts: [{ type: 'stat', value: stack.join(' · '), label: 'built with' }] }`. Panel renders that as-is.

- [ ] **Step 1: Write the failing tests:**

```js
// layout.test.mjs
test('mindView frames the whole skull with margin, phone and desktop', () => {
  for (const [narrow, aspect] of [[false, 16 / 9], [true, 0.46]]) {
    const v = mindView(narrow)
    const d = v.pos.distanceTo(v.look)
    const half = Math.tan((40 / 2) * Math.PI / 180) * d
    const r = MIND_SCALE(narrow)
    assert.ok(r < half * 0.8, 'skull taller than the frame')
    assert.ok(r < half * aspect * 0.9, 'skull wider than the frame')
    assert.ok(r > half * Math.min(1, aspect) * 0.55, 'skull too small to be the subject')
  }
})
// mind.test.mjs
test('projectFor: known ids from featured, null otherwise', () => {
  assert.equal(projectFor('zamindara').title, 'Zamindara')
  assert.equal(projectFor('rights').title, 'Rights')
  assert.equal(projectFor('dsa in java'), null)
  assert.equal(projectFor('nope'), null)
})
```

- [ ] **Step 2: Run** `npm test`. Expected: both new tests fail.

- [ ] **Step 3: Implement** `mindView` and `MIND_SCALE` in `layout.js`, centred on `headFor(narrow)`, and `projectFor` in `projects.js`. Run `npm test` and expect everything to pass.

- [ ] **Step 4: Wire up `Hub.jsx`:**
  - `const Mind = lazy(() => import('../mind/Mind.jsx'))`, and `const inMind = active === 'build'`.
  - `view`: use `mindView(narrow)` when `inMind`.
  - Hide the hub: when `inMind` turns true, scale the `Nest` group to 0 over 0.6 s, then set `vanished` (a timer cleared in the effect's cleanup and reset when `inMind` goes false). Render `{!away && !vanished && <Nest>…}`. On a first load already at `/c/build`, start with `vanished = true`.
  - Render `{inMind && <Suspense fallback={null}><Mind narrow={narrow} at={headFor(narrow)} picked={sub ?? null} onPick={goSub} /></Suspense>}` **outside** `<Rig>`.
  - Panel: `const project = inMind ? projectFor(sub) : null`. Pass `chapter={project ? { ...project, accent: activeNode.accent } : inMind ? null : (openSub ? … : chapter)}`, with `onBack={() => goSub(null)}` and `backLabel="← Build"` when there's a project.
  - Escape: treat `project` like `openSub`.
  - The `.hub-scene` background is already gone once `scene` is removed (step 5).

- [ ] **Step 5: Edit the content.** In `chapters.json` `build`, delete `place`, `scene` and the `"1 month"` stat. Change `lede` to `"The inside of my head."` and `body` to `[]`. Move the bee and IIT notes out of `todo`. In `work.js`, check that `projectId` gives `zamindara` and `rights`.

- [ ] **Step 6: Check it by hand.** Run `npm run dev` and open `http://localhost:5173/jugnibishnoi/`. Check each of these:
  - Tap Build: the hub falls away and the skull fades in, alone on screen.
  - Pulses run along the neurons.
  - Zamindara and Rights drift inside the skull, and their labels never overlap.
  - Tap Rights: it stops, the panel opens, and back returns to the skull.
  - Escape goes from project to skull to home.
  - Deep links `/c/build/rights` and `/c/build/nope` behave as Review Focus 1–2 describe.
  - Back pressed within 0.6 s brings the hub back.
  - Phone width (390 px) works.
  - DevTools Network: no `mind` chunk loads until Build is tapped.

- [ ] **Step 7:** Run `npm test && npm run lint && npm run build` and expect them all to pass.

- [ ] **Step 8:** Update `docs/CHANGING.md` with a short section, "Add a project to the head" (edit `featured` in `work.js`).

- [ ] **Step 9: Commit** with the message `Build opens into my head`.
