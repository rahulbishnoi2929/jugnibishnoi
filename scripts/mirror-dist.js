// Copies client/dist to dist at the repo root after a build.
//
// WHY THIS EXISTS
//
// Vercel looks for the build output in a directory that depends on the
// project's Root Directory setting, and three deploys failed on that
// mismatch. The error only ever says:
//
//   No Output Directory named "dist" found after the Build completed.
//
// which does not say whether it was looking at the repo root or inside
// client, and the two readings contradicted each other:
//
//   - the message names "dist", suggesting the repo root
//   - the project is called jugnibishnoi-client, suggesting client
//
// Rather than keep guessing at a setting that is not visible from here,
// the output now exists in both places. Whichever Vercel wants, it finds.
//
// This is a workaround, not a design. Once the Root Directory is known,
// delete this script and drop the mirror step from the root build script.
// It costs about a megabyte in the build container and nothing at runtime,
// and dist/ is gitignored so neither copy is committed.
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const from = path.join(root, 'client', 'dist')
const to = path.join(root, 'dist')

if (!fs.existsSync(from)) {
  console.error('mirror-dist: nothing at client/dist — did the build run?')
  process.exit(1)
}

fs.rmSync(to, { recursive: true, force: true })
fs.cpSync(from, to, { recursive: true })

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1),
    0
  )

console.log(`mirror-dist: client/dist -> dist (${count(to)} files)`)
