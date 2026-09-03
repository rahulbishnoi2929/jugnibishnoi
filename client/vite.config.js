import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Output stays at client/dist, Vite's default.
  //
  // I briefly moved it to ../dist to satisfy a Vercel error, which was
  // the wrong call: that project has its Root Directory set to client
  // (hence the name jugnibishnoi-client), so Vercel looks for dist inside
  // client and moving the build out of there guaranteed it would miss.
  // See DEPLOY.md.
})
