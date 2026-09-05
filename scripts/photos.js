// Turns a folder of phone photos into something a website can serve.
//
//   node scripts/photos.js
//
// Reads:  photos-raw/<chapter>/<set>/anything.jpg
// Writes: client/src/photos/<chapter>/<set>/anything.webp        (1600px)
//         client/src/photos/<chapter>/<set>/anything.thumb.webp  (480px)
//
// photos-raw/ is gitignored. The originals stay on this machine and never
// go near the repository, because a phone photo is about four megabytes and
// seventy-five of them is three hundred — two hundred times the size of the
// entire site as it stands.
//
// Three things happen here that are not just resizing.
//
// EXIF is stripped. A phone photo carries the GPS coordinates of where it
// was taken, which for photos from home is his front door. sharp drops all
// metadata unless asked to keep it, and this does not ask.
//
// Orientation is baked in. Phones store portrait shots as landscape plus an
// "actually, rotate this" flag; browsers mostly honour it and canvases
// mostly do not. Rotating the pixels means it is right everywhere.
//
// And a thumbnail is written alongside every photo, because a grid of
// seventy-five 1600px images is thirteen megabytes to show something the
// size of a stamp.
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const RAW = path.join(__dirname, '..', 'photos-raw')
const OUT = path.join(__dirname, '..', 'client', 'src', 'photos')

const FULL = 1600 // longest edge, for the one you are looking at
const THUMB = 480 // longest edge, for the grid
const SOURCE = /\.(jpe?g|png|webp|avif|heic|heif|tiff?)$/i

const slug = (name) =>
  name
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

async function one(from, to) {
  const image = sharp(from).rotate() // rotate() with no angle applies EXIF
  const { width, height, format } = await image.metadata()

  await image
    .clone()
    .resize({ width: FULL, height: FULL, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(to)

  await image
    .clone()
    .resize({ width: THUMB, height: THUMB, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(to.replace(/\.webp$/, '.thumb.webp'))

  return { width, height, format }
}

async function main() {
  if (!fs.existsSync(RAW)) {
    console.log('photos: no photos-raw/ folder yet.')
    console.log('        Make one, put photos in photos-raw/<chapter>/<set>/,')
    console.log('        for example photos-raw/campus/athletics/, then run this again.')
    return
  }

  let done = 0
  let failed = 0
  let rawBytes = 0
  let outBytes = 0

  for (const chapter of fs.readdirSync(RAW, { withFileTypes: true })) {
    if (!chapter.isDirectory()) continue
    for (const set of fs.readdirSync(path.join(RAW, chapter.name), { withFileTypes: true })) {
      if (!set.isDirectory()) continue

      const from = path.join(RAW, chapter.name, set.name)
      const to = path.join(OUT, chapter.name, set.name)
      fs.mkdirSync(to, { recursive: true })

      const files = fs.readdirSync(from).filter((f) => SOURCE.test(f)).sort()
      for (const file of files) {
        const target = path.join(to, slug(file) + '.webp')
        try {
          rawBytes += fs.statSync(path.join(from, file)).size
          await one(path.join(from, file), target)
          outBytes +=
            fs.statSync(target).size +
            fs.statSync(target.replace(/\.webp$/, '.thumb.webp')).size
          done++
        } catch (e) {
          failed++
          console.error(`  ! ${chapter.name}/${set.name}/${file}: ${e.message}`)
        }
      }
      if (files.length) {
        console.log(`${chapter.name}/${set.name}: ${files.length} photos`)
      }
    }
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + 'MB'
  console.log('')
  console.log(`photos: ${done} done${failed ? ', ' + failed + ' failed' : ''}`)
  if (done) {
    console.log(`        ${mb(rawBytes)} of originals -> ${mb(outBytes)} on the site`)
    console.log('        EXIF stripped, orientation baked in, thumbnails written')
  }
  if (failed) {
    console.log('')
    console.log('        HEIC is the usual failure — iPhones shoot it and not every')
    console.log('        build of sharp can read it. Export those as JPEG and rerun.')
  }
}

main()
