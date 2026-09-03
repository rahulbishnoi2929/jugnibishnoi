// GitHub Pages serves this project from /jugnibishnoi/, not from the root,
// so any path written as "/textures/earth.svg" would 404 in production
// while working perfectly in dev. Everything hand-written goes through
// here instead.
//
// Files imported through the bundler — the photos in src/photos, for
// instance — already get the base prefix from Vite and must NOT be passed
// to this.
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export const asset = (path) => base + (path.startsWith('/') ? path : '/' + path)
