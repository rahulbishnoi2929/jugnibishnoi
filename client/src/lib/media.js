// Photos and clips are discovered from the folder, not listed anywhere.
//
// Drop a file into src/photos/<chapter>/<set>/ and it appears. The set is
// what the photos are of — athletics, installation, hackathon — and which
// branch a set belongs under is declared in captions.json, so folders stay
// flat and obvious to drag things into.
//
// Vite resolves these globs at build time, so the files are hashed and
// cached like any other asset, but nothing has to be registered by hand.
//
// scripts/photos.js writes each photo twice: `name.webp` at 1600px and
// `name.thumb.webp` at 480. The grid shows thumbnails and the full one is
// only fetched when you open it — seventy-five 1600px photos is thirteen
// megabytes, and a grid does not need any of it.
import captions from '../content/captions.json'

const full = import.meta.glob('../photos/*/*/*.{webp,jpg,jpeg,png,avif,mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const VIDEO = /\.(mp4|webm)$/i
const THUMB = /\.thumb\.webp$/i

// '../photos/campus/athletics/03-high-jump.webp'
//   -> { chapter: 'campus', set: 'athletics', name: '03-high-jump' }
function parse(path) {
  const [, , chapter, set, file] = path.split('/')
  return { chapter, set, name: file.replace(/\.(thumb\.)?[^.]+$/, ''), file }
}

// '03-high-jump' -> 'High jump'. The filename is the fallback alt text,
// which is why it is worth naming them well — but a real caption in
// captions.json wins.
const readable = (name) => {
  const label = name
    .replace(/^\d+[-_\s]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const photos = []
for (const [path, url] of Object.entries(full)) {
  if (THUMB.test(path)) continue
  const { chapter, set, name } = parse(path)
  const thumbPath = path.replace(/\.webp$/, '.thumb.webp')
  const fact = captions.photos?.[`${chapter}/${set}/${name}`] ?? {}
  photos.push({
    id: `${chapter}/${set}/${name}`,
    chapter,
    set,
    url,
    // Falls back to the full image where no thumbnail was written, which
    // is the case for anything not put through scripts/photos.js.
    thumb: full[thumbPath] ?? url,
    video: VIDEO.test(path),
    label: fact.what || readable(name),
    // when / where / what / why, any of which may be missing. A photo with
    // nothing written about it still shows.
    ...fact,
  })
}

// Numeric prefixes decide the order; without one it falls back to name.
photos.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

// Every set that some branch has claimed. Those belong to the branch, not
// to the chapter's own panel — otherwise opening Campus tips all
// seventy-five sports photos into the reading column.
const claimed = new Set()
for (const [key, sets] of Object.entries(captions.branches ?? {})) {
  const chapter = key.split('/')[0]
  for (const { set } of sets) claimed.add(`${chapter}/${set}`)
}

// A chapter's own loose photos: the ones no branch has taken.
export function mediaFor(chapterId) {
  return photos.filter(
    (p) => p.chapter === chapterId && !claimed.has(`${p.chapter}/${p.set}`)
  )
}

// The sets under one branch of a chapter, each with its own photos, in the
// order captions.json lists them.
export function setsFor(chapterId, branchId) {
  const wanted = captions.branches?.[`${chapterId}/${branchId}`] ?? []
  return wanted
    .map(({ set, title, lede }) => ({
      set,
      title: title ?? readable(set),
      lede,
      photos: photos.filter((p) => p.chapter === chapterId && p.set === set),
    }))
    .filter((s) => s.photos.length > 0)
}

// How many photos sit under a branch, for a count on its node.
export const countFor = (chapterId, branchId) =>
  setsFor(chapterId, branchId).reduce((n, s) => n + s.photos.length, 0)
