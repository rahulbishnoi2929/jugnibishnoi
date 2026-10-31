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
// "Babbu Maan - Pagal Shayar" on the Babbu Maan channel is just "Pagal
// Shayar". Done as a prefix test rather than a built regular expression:
// an artist name is arbitrary text, and escaping it into a pattern is the
// kind of thing that works until someone is called AC/DC.
function dropArtist(s, artist) {
  if (!artist || !s.toLowerCase().startsWith(artist.toLowerCase())) return s
  const rest = s.slice(artist.length).trimStart()
  if (!/^[-–—:|]/.test(rest)) return s
  const left = rest.slice(1).trim()
  // Only if something is actually left. "Diljit Dosanjh" on the Diljit
  // Dosanjh channel is all the title there is.
  return left || s
}

// The tail YouTube puts after a song's name: "Full Song", "8K/4K Music
// Video", "Song Lyrics". Separate from the keyword rule above because it
// does not need a dash in front of it — half of these just run straight
// on from the name.
const TAIL =
  /\s*[-–—:]?\s*\b(?:\d+K(?:\s*\/\s*\d+K)?\s*)?(?:full\s+video\s+song|full\s+video|full\s+song|full\s+audio|music\s+video|video\s+song|audio\s+song|song\s+lyrics|with\s+lyrics|lyrics|lyrical|full\s+hd|new\s+songs?\s*\d{4}|official\s+video|official)\b.*$/i

function clean(title, artist) {
  // The artist comes off first, because it can be on either side of a
  // separator. "Diljit Dosanjh : Love Like This : Official Audio" splits
  // to "Diljit Dosanjh" if you cut at the separator before taking the
  // name off, which throws the song away and keeps the singer.
  let s = dropArtist(title, artist)
    // "Lyrical: Dupatta Tera Nau Rang Da" is a label on the front, not
    // part of the name. Only when it is one of these words and only when
    // a colon follows it, so "VOID: Diljit Dosanjh" is left alone.
    .replace(/^\s*(lyrical|full\s+video|full\s+song|official\s+video|official\s+audio|video\s+song|audio|video)\s*:\s*/i, '')

  s = s
    // A lone lowercase l between spaces is a pipe someone typed wrong,
    // and a colon with spaces either side is a separator too. A colon
    // without them is usually part of the name, as in "VOID: Diljit
    // Dosanjh", so that one is left alone.
    .replace(/\s+l\s+/g, ' | ')
    // The danda is a full stop in Devanagari and a separator here, used
    // exactly the way a pipe is: "Jahaan Tum Ho Slowed+Reverb Song ।
    // Shrey Singhal".
    .replace(/\s*।\s*/g, ' | ')
    .replace(/\s+:\s+/g, ' | ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s*\|.*$/, '')
    .replace(/\s*[-–—]\s*(official|full|latest|new|lyrical|audio|video)[^-–—]*$/i, '')

  // And again, in case the segment we kept was "Artist - Song".
  s = dropArtist(s.trim(), artist)

  // Only if it leaves something. A song really called "Lyrics" would
  // otherwise come out blank, and a wrong title beats no title.
  const trimmed = s.replace(TAIL, '').trim()
  if (trimmed) s = trimmed
  return s.replace(/\s{2,}/g, ' ').replace(/\s*[-–—,]\s*$/, '').trim()
}

// A whole playlist, or just one song. Both are links someone pastes, and
// having to think about which is which is a reason not to bother.
const listId = link.match(/[?&]list=([\w-]+)/)?.[1] ?? null
const single = listId ? null : link.match(/[?&]v=([\w-]{11})/)?.[1] ?? link.match(/^[\w-]{11}$/)?.[0]

let page = ''
let name = single ? 'one song' : null
if (listId) {
  page = await fetch(`https://www.youtube.com/playlist?list=${listId}`, {
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  }).then((r) => r.text())
  name = page.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, '')
}

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
if (single) ids.push(single)
if (!ids.length) {
  // YouTube shows "The playlist does not exist" for a private one as well
  // as for a deleted one — from outside they look the same. Unlisted is
  // enough; it does not have to be public.
  console.error('No videos found.')
  console.error('YouTube only shows a playlist to the person who owns it while')
  console.error('it is set to Private. Open it on YouTube and set it to Unlisted,')
  console.error('then try again. Or paste one video link and this adds that song.')
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

// Songs taken out on purpose stay out. Without this, re-importing a
// playlist quietly undoes the curation: a duplicate deleted last week is
// still in the playlist on YouTube, so it comes straight back.
const dropped = new Set(list.removed ?? [])
const already = new Set(list.songs.map((s) => s.yt))
const added = songs.filter((s) => !already.has(s.yt) && !dropped.has(s.yt))
list.songs.push(...added)
writeFileSync(file, JSON.stringify(data, null, 2) + '\n')

console.log(`${added.length} added to "${target}" (${list.songs.length} total)`)
const skipped = songs.filter((s) => dropped.has(s.yt)).length
if (skipped) console.log(`${skipped} skipped — listed under "removed"`)
if (blocked.length) {
  console.log(`\n${blocked.length} left out — embedding is blocked, so they would not play:`)
  for (const id of blocked) console.log(`  https://youtu.be/${id}`)
}
