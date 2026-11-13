import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so the bundle has to
// be built with that prefix. Overridable, so a future move to a root
// domain is one env var rather than an edit:
//
//   BASE=/ npm run build
const base = process.env.BASE ?? '/jugnibishnoi/'

export default defineConfig({
  base,
  plugins: [react()],
  // A port of its own. 5173 is vite's default, so every other project on
  // this machine wants it too, and a dev server that quietly lands on a
  // different port each time is a dev server you cannot bookmark.
  server: { port: 5186, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // The libraries in their own chunks, apart from the site.
        //
        // three.js is most of a megabyte and changes only when a
        // dependency is deliberately updated; the site's own code changes
        // every push. In one chunk together, every push made a repeat
        // visitor download three.js again. Apart, the heavy parts stay
        // cached across deploys and a push costs a visitor only the code
        // that actually changed.
        //
        // A function rather than a list of package names. The list form
        // only claims the entry file of each package, so React's JSX
        // runtime — a separate file inside react — was left for Rollup to
        // place, and it put it in the r3f chunk because r3f uses it too.
        // The r3f chunk imports three.js, so every page, including the
        // plain ones, loaded the whole 3D engine to get JSX.
        //
        // And Vite's preload helper — the code behind every lazy import —
        // goes with React. It is not in node_modules, so unclaimed it was
        // put in the r3f chunk because drei lazy-loads things too, and
        // the plain pages imported three.js to get the function that
        // exists to not load things.
        manualChunks(id) {
          if (id.includes('preload-helper') || id.includes('commonjsHelpers')) return 'react'
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'three'
          if (/[\\/]node_modules[\\/]@react-three[\\/]/.test(id)) return 'r3f'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
        },
      },
    },
  },
})
