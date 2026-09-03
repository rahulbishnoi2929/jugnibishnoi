import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Build to dist/ at the repo root, not client/dist.
  //
  // Vercel detects the Vite preset on import and looks for dist/ relative
  // to the project root; vercel.json's outputDirectory did not override
  // that, and the deploy failed with "No Output Directory named dist"
  // even though the build itself succeeded. Putting the output where it
  // already looks removes the question of which setting wins.
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
