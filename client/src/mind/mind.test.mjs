// Run: node client/src/mind/mind.test.mjs
//
// The head is generated, not modelled, so a mistake in it is a mistake in
// arithmetic — and a cloud full of NaN draws nothing at all, which looks
// exactly like a head that has not loaded yet.

import assert from 'node:assert/strict'
import { projectFor } from './projects.js'
import { skull, skullSdf, neurons, inBrain, loops, loopAt, BRAIN } from './mind.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    console.log('  ok  ' + name)
    passed++
  } catch (e) {
    console.log('  FAIL  ' + name)
    console.log('        ' + e.message)
    process.exitCode = 1
  }
}

const at = (pos, i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]

test('skull: right count, all finite, inside the unit sphere', () => {
  const s = skull({ count: 3000 })
  assert.equal(s.pos.length, 9000)
  assert.equal(s.size.length, 3000)
  for (let i = 0; i < 3000; i++) {
    const [x, y, z] = at(s.pos, i)
    assert.ok(Number.isFinite(x + y + z), 'point ' + i + ' is not a number')
    assert.ok(Math.hypot(x, y, z) <= 1.0001, 'point ' + i + ' is outside the unit sphere')
  }
})

test('skull: points sit on the surface', () => {
  const s = skull({ count: 2000 })
  for (let i = 0; i < 2000; i++) {
    const d = skullSdf(at(s.pos, i))
    assert.ok(Math.abs(d) < 0.02, 'point ' + i + ' is ' + d.toFixed(3) + ' off the bone')
  }
})

test('skull: has eye sockets — the socket centres are outside the bone', () => {
  assert.ok(skullSdf([0.2, -0.05, 0.6]) > 0, 'right socket is filled in')
  assert.ok(skullSdf([-0.2, -0.05, 0.6]) > 0, 'left socket is filled in')
  assert.ok(skullSdf([0, 0.15, -0.05]) < 0, 'middle of the cranium is inside')
})

test('skull: every point carries a unit normal', () => {
  const s = skull({ count: 1000 })
  assert.equal(s.normal.length, s.pos.length)
  for (let i = 0; i < 1000; i++) {
    const l = Math.hypot(s.normal[i * 3], s.normal[i * 3 + 1], s.normal[i * 3 + 2])
    assert.ok(Math.abs(l - 1) < 1e-3, 'normal ' + i + ' has length ' + l)
  }
})

test('skull: has a nose — the middle of the nasal opening is not bone', () => {
  assert.ok(skullSdf([0, -0.18, 0.6]) > 0)
})

test('skull: same seed, same head', () => {
  assert.deepEqual(skull({ seed: 3, count: 500 }).pos, skull({ seed: 3, count: 500 }).pos)
})

test('the brain is inside the skull', () => {
  const [cx, cy, cz] = BRAIN.c
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const p = [cx + dx * BRAIN.r[0], cy + dy * BRAIN.r[1], cz + dz * BRAIN.r[2]]
    assert.ok(skullSdf(p) < 0, 'the brain pokes out at ' + p.map((v) => v.toFixed(2)))
  }
})

test('neurons: every vertex finite and inside the brain', () => {
  const n = neurons({ seeds: 10 })
  assert.ok(n.pos.length > 600, 'enough to look like a brain')
  assert.equal(n.pos.length / 3, n.along.length)
  assert.equal(n.along.length, n.phase.length)
  assert.equal((n.pos.length / 3) % 2, 0, 'segments come in pairs of vertices')
  for (let i = 0; i < n.pos.length; i += 3) {
    const p = [n.pos[i], n.pos[i + 1], n.pos[i + 2]]
    assert.ok(Number.isFinite(p[0] + p[1] + p[2]))
    assert.ok(inBrain(p), 'a neuron left the brain')
    assert.ok(skullSdf(p) < 0, 'a neuron is in a socket or outside the bone')
  }
  for (const a of n.along) assert.ok(a >= 0 && a <= 1)
  for (const f of n.phase) assert.ok(f >= 0 && f < 1)
})

test('neurons: same seed, same brain', () => {
  assert.deepEqual(neurons({ seed: 2, seeds: 4 }).pos, neurons({ seed: 2, seeds: 4 }).pos)
})

test('loops: closed, inside the brain, never touching each other', () => {
  for (const count of [1, 2, 3]) {
    const ls = loops(count, {})
    assert.equal(ls.length, count)
    for (const l of ls) {
      const a = loopAt(l, 0).map((v) => v.toFixed(6))
      const b = loopAt(l, 1).map((v) => v.toFixed(6))
      assert.deepEqual(a, b, 'a loop does not close')
    }
    for (let t = 0; t < 1; t += 0.01) {
      const at = ls.map((l) => loopAt(l, t))
      // Well inside, not merely inside: the label is drawn round the point,
      // and a point on the edge of the brain puts half a label outside the
      // head.
      for (const p of at) {
        assert.ok(inBrain(p, 0.75), 'a project wandered to the edge of the brain')
        assert.ok(skullSdf(p) < -0.08, 'a project is too close to the bone')
      }
      for (let i = 0; i < at.length; i++)
        for (let j = i + 1; j < at.length; j++)
          assert.ok(
            Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1], at[i][2] - at[j][2]) > 0.25,
            count + ' projects came within touching distance at t=' + t.toFixed(2)
          )
    }
  }
})

test('projectFor: known ids from featured, null otherwise', () => {
  assert.equal(projectFor('zamindara').title, 'Zamindara')
  assert.equal(projectFor('rights').title, 'Rights')
  assert.equal(projectFor('dsa in java'), null, 'only featured work belongs in the head')
  assert.equal(projectFor('nope'), null)
  assert.equal(projectFor(undefined), null)
  const z = projectFor('zamindara')
  assert.equal(z.id, 'zamindara')
  assert.equal(z.lede, 'Uber for farm machinery.')
  assert.equal(z.body.length, 2)
  assert.match(z.artifacts[0].value, /PostGIS/)
})

console.log('\n' + passed + ' passed')
