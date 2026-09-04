// Builds a page that compiles and links the hub's shaders and reports what
// the driver says about them.
//
//   node scripts/shader-check.js      then open scripts/shader-check.html
//
// This exists because the preview pane used to build this pauses
// requestAnimationFrame, so nothing in the 3D scene ever renders there and
// a shader that failed to compile would look exactly like a shader that
// worked — an invisible layer and a silent frame loop. Compiling GLSL,
// unlike drawing with it, is a synchronous call, so it can be checked in a
// pane that never paints.
//
// The page is written self-contained on purpose: open it from the file
// system, no server, no build step.
const fs = require('fs')
const path = require('path')

async function main() {
  const shaders = await import(
    'file://' + path.join(__dirname, '..', 'client', 'src', 'hub', 'shaders.js')
  )

  // The uniforms each material's frame loop writes every tick. If one is
  // missing from the linked program it is being set into a void, which the
  // link step alone will not tell you.
  const built = {
    star: {
      m: shaders.starMaterial({ falloff: 1.6 }),
      uniforms: ['uScale', 'uSize', 'uOpacity'],
    },
    planet: {
      m: shaders.planetMaterial('#d4a72c', [0.1, 0, 0.2]),
      uniforms: ['uColor', 'uCentre', 'uAxis', 'uBands', 'uOpacity'],
    },
    ring: {
      m: shaders.ringMaterial('#d8c68f', [0.1, 0, 0.2], 0.04, 0.08),
      uniforms: ['uColor', 'uInner', 'uOuter', 'uOpacity'],
    },
    ellipticalStar: {
      m: shaders.starMaterial({ elliptical: true }),
      uniforms: ['uScale', 'uSize', 'uOpacity'],
    },
    orbit: {
      m: shaders.orbitMaterial('#8ea6c4', 1),
      uniforms: ['uColor', 'uRadius', 'uOpacity'],
    },
  }

  const data = {}
  for (const [name, { m, uniforms }] of Object.entries(built)) {
    data[name] = {
      vs: m.vertexShader,
      fs: m.fragmentShader,
      color: !!m.vertexColors,
      // A material's own defines have to go into the prefix, or the
      // elliptical variant compiles without ELLIPTICAL and its two extra
      // attributes silently vanish.
      defines: Object.keys(m.defines || {}),
      uniforms,
    }
  }

  const template = fs.readFileSync(path.join(__dirname, 'shader-check.tpl.html'), 'utf8')
  const page = template.replace('/*SHADERS*/null', JSON.stringify(data))
  const out = path.join(__dirname, 'shader-check.html')
  fs.writeFileSync(out, page)
  console.log('shader-check: wrote ' + out + ' — open it in a browser')
}

main()
