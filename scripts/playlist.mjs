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

// YouTube gives every artist an auto-generated "- Topic" channel, and a
// label-run "VEVO" one. The name in front of either is the real artist,
// which is better than most channel names you get.
const artistOf = (a) =>
  (a ?? '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim()

// Comparing names by their letters and digits only.
//
// A VEVO channel is the artist with the spaces taken out — 50CentVEVO,
// LuisFonsiVEVO, KendrickLamarVEVO — so "50Cent" has to match "50 Cent"
// in a title or the rule never fires on the one playlist that is nearly
// all VEVO. It also makes punctuation stop mattering, which is free.
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// What is left after a name at the front, or null if it is not there.
function afterName(title, name) {
  const want = key(name)
  if (!want) return null
  let got = ''
  let i = 0
  for (; i < title.length && got.length < want.length; i++) {
    const c = title[i].toLowerCase()
    if (/[a-z0-9]/.test(c)) got += c
  }
  if (got !== want) return null
  const rest = title.slice(i).replace(/^\s*[-–—:|,.]?\s*/, '').trim()
  return rest || null
}

// And before a name at the end.
function beforeName(title, name) {
  const want = key(name)
  if (!want) return null
  let got = ''
  let i = title.length
  for (; i > 0 && got.length < want.length; i--) {
    const c = title[i - 1].toLowerCase()
    if (/[a-z0-9]/.test(c)) got = c + got
  }
  if (got !== want) return null
  const head = title.slice(0, i).replace(/\s*[-–—:|,.]?\s*$/, '').trim()
  return head || null
}

// "Babbu Maan - Pagal Shayar" on the Babbu Maan channel is just "Pagal
// Shayar". Only ever when something is left behind: "Diljit Dosanjh" on
// the Diljit Dosanjh channel is all the title there is.
const dropArtist = (s, artist) => afterName(s, artist) ?? s

// The tail YouTube puts after a song's name: "Full Song", "8K/4K Music
// Video", "Song Lyrics". Separate from the keyword rule inside clean()
// because it needs no dash in front of it — half of these run straight on
// from the name.
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
  songs.push({ yt: id, raw: title, artist: artistOf(author_name) })
  process.stdout.write('.')
}
process.stdout.write('\n')

const file = new URL('../client/src/content/playlists.json', import.meta.url)
const data = JSON.parse(readFileSync(file, 'utf8'))

// Every artist name already known, from this batch and from everything
// imported before it.
//
// This is the rule that does what no amount of keyword-stripping could:
// "Diljit Dosanjh: Love Ya" on the Saregama channel has the artist in the
// title and a label in the artist field, so there is nothing to match it
// against — unless you have seen Diljit Dosanjh be an artist somewhere
// else, which by the fourth playlist you have.
//
// Longest first, so "Arjan Dhillon" is taken off before "Arjan" would be.
// Capped at three words and five characters to keep it to names: a label
// called "Music" would otherwise eat half of every title.
const known = [
  ...new Set([
    ...songs.map((s) => s.artist),
    ...data.playlists.flatMap((p) => p.songs.map((s) => s.artist)),
  ]),
]
  .filter((a) => a && a.length > 4 && a.split(/\s+/).length <= 3)
  .sort((a, b) => b.length - a.length)

// A last tidy, after every name has been taken off.
//
// Stripping a featured artist leaves the "ft." behind pointing at
// nothing — "Luis Fonsi - Despacito ft. Daddy Yankee" becomes "Despacito
// ft" once both names are gone — and taking a name off the front can
// leave its punctuation, since "The Notorious B.I.G. - Big Poppa" ends
// the name on a full stop and the dash is the next character but one.
const LEAD = /^[\s\-–—:|,.]+/
const DANGLE = /[\s,]+(ft|feat|featuring|with|x|&)\.?$/i
const tidy = (s) =>
  s.replace(LEAD, '').replace(DANGLE, '').replace(/[\s,\-–—]+$/, '').trim()

function dropKnown(title) {
  // Repeated until it stops changing, because one pass is
  // order-dependent and that is not a detail. "VOID: Diljit Dosanjh
  // Intense" only ends with "Diljit Dosanjh" once "Intense" has gone, and
  // the list is longest-first, so the longer name is tested while it is
  // still buried. Four passes is well past what any real title needs.
  let s = title
  for (let pass = 0; pass < 4; pass++) {
    const before = s
    for (const a of known) {
      s = afterName(s, a) ?? beforeName(s, a) ?? s
    }
    if (s === before) break
  }
  return s.trim()
}

for (const s of songs) {
  const once = clean(s.raw, s.artist)
  s.title = tidy(dropKnown(once)) || tidy(once) || once || s.raw
  delete s.raw
}
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
