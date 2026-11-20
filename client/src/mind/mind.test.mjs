// Run: node client/src/mind/mind.test.mjs
//
// The head is generated, not modelled, so a mistake in it is a mistake in
// arithmetic — and a cloud full of NaN draws nothing at all, which looks
// exactly like a head that has not loaded yet.

import assert from 'node:assert/strict'
import { skull, skullSdf } from './mind.js'

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

test('skull: same seed, same head', () => {
  assert.deepEqual(skull({ seed: 3, count: 500 }).pos, skull({ seed: 3, count: 500 }).pos)
})

console.log('\n' + passed + ' passed')
