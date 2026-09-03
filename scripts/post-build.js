// Copies index.html to 404.html in the build output.
//
// GitHub Pages has no rewrite rules, so a request for /jugnibishnoi/c/soil
// finds no such file and serves 404.html. Making that a copy of index.html
// hands the request to the client router, which then resolves the route
// normally — the standard trick for a single-page app on Pages.
//
// Without this, the hub works but every branch link 404s on a hard load or
// when someone else opens it, which is most of how a branch gets reached.
const fs = require('fs')
const path = require('path')

const dist = path.join(__dirname, '..', 'client', 'dist')
const index = path.join(dist, 'index.html')

if (!fs.existsSync(index)) {
  console.error('post-build: no client/dist/index.html — did the build run?')
  process.exit(1)
}

fs.copyFileSync(index, path.join(dist, '404.html'))
console.log('post-build: index.html -> 404.html (SPA fallback for Pages)')
