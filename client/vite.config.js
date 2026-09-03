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
})
