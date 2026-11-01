// Squeeze a scan's texture set down to something a web page can carry.
//
//   node scripts/model-textures.mjs <folder of jpegs> <out folder>
//
// The download that prompted this was 66MB, 31 of it textures, against a
// whole site of 10.5. Most of that is maps this scene cannot use: gloss,
// ambient occlusion, translucency, subsurface scattering, and a floor the
// model is standing on. What is left is colour and normal for the four
// body parts, plus the eyes and lashes.
//
// 1024 rather than 4096, because he is about 400 pixels tall on screen
// and at that size the difference is theoretical. WebP at 82, which on
// skin is indistinguishable from the JPEG it came from.
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const [, , src, out] = process.argv
if (!src || !out) {
  console.error('usage: node scripts/model-textures.mjs <src folder> <out folder>')
  process.exit(1)
}
mkdirSync(out, { recursive: true })

// What the body is made of, and what each part actually needs. The floor
// and the base are the plinth the model ships standing on; they go.
const PARTS = ['head', 'torso', 'arms', 'legs', 'mutand', 'occhi', 'ciglia']

// The exporter prefixes every file with what it is, which is more
// trustworthy than reading the rest of the name: RGB_ is colour, N_ is a
// normal map, R_ is everything else — roughness, bump, gloss, AO,
// translucency, scattering. Classifying by the tail instead matched
// "occhi" twice and silently overwrote the colour map with the bump one.
const want = (f) => {
  if (!/\.(jpe?g|png)$/i.test(f)) return null
  if (/floor|base/i.test(f)) return null
  const kind = f.startsWith('RGB_') ? 'albedo' : f.startsWith('N_') ? 'normal' : null
  if (!kind) return null
  const part = PARTS.find((p) => f.toLowerCase().includes(p))
  return part ? `${part}-${kind}.webp` : null
}

let before = 0
let after = 0
const written = []
for (const f of readdirSync(src)) {
  const name = want(f)
  if (!name) continue
  const from = join(src, f)
  before += statSync(from).size
  // Normals must not be resized with a filter that invents directions,
  // so they keep their full range and take a gentler shrink.
  const isNormal = name.endsWith('normal.webp')
  const info = await sharp(from)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true, kernel: isNormal ? 'nearest' : 'lanczos3' })
    .webp({ quality: isNormal ? 90 : 82, effort: 5 })
    .toFile(join(out, name))
  after += info.size
  written.push([name, info.size])
}

written.sort((a, b) => b[1] - a[1])
for (const [n, s] of written) console.log(`  ${n.padEnd(22)}${(s / 1024).toFixed(0).padStart(5)} KB`)
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'
console.log(`\n${written.length} maps kept — ${mb(before)} in, ${mb(after)} out (${(100 - (after / before) * 100).toFixed(0)}% smaller)`)
