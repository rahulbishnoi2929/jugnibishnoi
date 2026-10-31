// Pull a YouTube playlist into client/src/content/playlists.json.
//
//   node scripts/playlist.mjs yaadaan "https://www.youtube.com/playlist?list=..."
//
// Reads the playlist page for its video ids, then asks YouTube's oEmbed
// endpoint for each one's real title and channel. oEmbed is the useful
// part: no API key, no quota, and it refuses any video that is blocked
// from embedding — which is exactly the set that would sit in the list
// looking fine and then refuse to play. Those are reported and left out.
//
// The JSON is the source of truth afterwards. Reorder it, rename things,
// delete what you do not want. Running this again only adds songs that
// are not already in the list, so your edits survive.
import { readFileSync, writeFileSync } from 'node:fs'

const [, , target, link] = process.argv
if (!target || !link) {
  console.error('usage: node scripts/playlist.mjs <playlist-id> <youtube playlist url>')
  process.exit(1)
}

// YouTube gives every artist an auto-generated "- Topic" channel, and the
// name in front of it is the real artist — better than most channel names.
const artistOf = (a) => (a ?? '').replace(/\s*-\s*Topic$/i, '').trim()

// Titles carry the label, the year, "Official Video", the channel's own
// name, and a tail of keywords after a pipe. This cannot be perfect —
// they are typed by whoever uploaded them — so it takes the safe cuts and
// leaves the rest to you.
function clean(title, artist) {
  let s = title
    // A lone lowercase l between spaces is a pipe someone typed wrong.
    // It is common enough in this corner of YouTube to be worth knowing.
    .replace(/\s+l\s+/g, ' | ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s*\|.*$/, '')
    .replace(/\s*[-\u2013\u2014]\s*(official|full|latest|new|lyrical|audio|video)[^-\u2013\u2014]*$/i, '')

  // "Babbu Maan - Pagal Shayar" on the Babbu Maan channel is just
  // "Pagal Shayar". Done as a prefix test rather than a built regular
  // expression: an artist name is arbitrary text, and escaping it into a
  // pattern is the kind of thing that works until someone is called
  // AC/DC.
  if (artist && s.toLowerCase().startsWith(artist.toLowerCase())) {
    const rest = s.slice(artist.length).trimStart()
    if (/^[-–—:]/.test(rest)) s = rest.slice(1).trimStart()
  }
  return s.replace(/\s{2,}/g, ' ').replace(/\s*[-\u2013\u2014,]\s*$/, '').trim()
}

const listId = link.match(/[?&]list=([\w-]+)/)?.[1] ?? link
const page = await fetch(`https://www.youtube.com/playlist?list=${listId}`, {
  headers: { 'accept-language': 'en-US,en;q=0.9' },
}).then((r) => r.text())

const name = page.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, '')

// Every video in the page, in order, de-duplicated.
//
// Taken as plain ids rather than off a named renderer. The wrapper
// YouTube puts a playlist row in has already changed once — it was
// playlistVideoRenderer and is lockupViewModel now — so keying on that
// name means this breaks the next time they rename something. Ids in
// document order is the part that does not move, and anything that is
// not really in the playlist gets caught by the oEmbed lookup below.
const ids = []
const seen = new Set()
for (const m of page.matchAll(/"videoId":"([\w-]{11})"/g)) {
  if (!seen.has(m[1])) {
    seen.add(m[1])
    ids.push(m[1])
  }
}
if (!ids.length) {
  console.error('No videos found. Is the playlist public or unlisted?')
  process.exit(1)
}
console.log(`"${name}" — ${ids.length} videos`)

const songs = []
const blocked = []
for (const id of ids) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    'https://www.youtube.com/watch?v=' + id
  )}&format=json`
  const res = await fetch(url)
  if (!res.ok) {
    blocked.push(id)
    continue
  }
  const { title, author_name } = await res.json()
  const artist = artistOf(author_name)
  songs.push({ yt: id, title: clean(title, artist), artist })
  process.stdout.write('.')
}
process.stdout.write('\n')

const file = new URL('../client/src/content/playlists.json', import.meta.url)
const data = JSON.parse(readFileSync(file, 'utf8'))
const list = data.playlists.find((p) => p.id === target)
if (!list) {
  console.error(
    `No playlist called "${target}". There are: ` +
      data.playlists.map((p) => p.id).join(', ')
  )
  process.exit(1)
}

const already = new Set(list.songs.map((s) => s.yt))
const added = songs.filter((s) => !already.has(s.yt))
list.songs.push(...added)
writeFileSync(file, JSON.stringify(data, null, 2) + '\n')

console.log(`${added.length} added to "${target}" (${list.songs.length} total)`)
if (blocked.length) {
  console.log(`\n${blocked.length} left out — embedding is blocked, so they would not play:`)
  for (const id of blocked) console.log(`  https://youtu.be/${id}`)
}
