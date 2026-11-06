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
})
