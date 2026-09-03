// Photos and clips are discovered from the folder, not listed anywhere.
// Drop a file into src/photos/<chapter>/ and it appears in that chapter.
//
// Vite resolves this glob at build time, so the files are hashed and
// cached like any other asset — but nothing has to be registered by hand.
const files = import.meta.glob(
  '../photos/*/*.{jpg,jpeg,JPG,JPEG,png,PNG,webp,avif,mp4,MP4,webm}',
  { eager: true, query: '?url', import: 'default' }
)

const VIDEO = /\.(mp4|webm)$/i

// `03_wheat-harvest.jpg` -> { order: '03', label: 'wheat harvest' }
// The filename is the alt text, which is why it is worth naming them well.
function describe(path) {
  const file = path.split('/').pop()
  const stem = file.replace(/\.[^.]+$/, '')
  const label = stem
    .replace(/^\d+[-_\s]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    video: VIDEO.test(file),
  }
}

export function mediaFor(chapterId) {
  return Object.entries(files)
    .filter(([path]) => path.includes(`/photos/${chapterId}/`))
    // numeric prefixes decide the order; without one it falls back to name
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([path, url]) => ({ url, ...describe(path) }))
}
