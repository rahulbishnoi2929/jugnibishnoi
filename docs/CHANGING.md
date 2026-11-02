# CHANGING THINGS

What to open for the change you want to make, and what will tell you if you
got it wrong.

Everything here assumes:

```bash
npm install
npm run dev          # http://localhost:5173/jugnibishnoi/
npm test             # 47 assertions, two seconds
npm run lint
```

Push to `main` and it deploys itself. Nothing else is needed.

---

## Add songs to a playlist

```bash
node scripts/playlist.mjs rap "https://www.youtube.com/playlist?list=PL..."
```

The playlist id is the one in `client/src/content/playlists.json` — `rap`,
`party`, `hr`, `chatpate`, `anytime`, `lovable`, `yaadaan`, `intensity`,
`favourites`. It only adds songs that are not already there, so your edits
survive re-running it, and songs listed under `removed` stay removed.

It will leave some titles wrong. YouTube titles are not song names, and the
cleaner guesses: hashtags, "Lyric Video", channel names, cast lists. **Read
the list afterwards and fix the stragglers by hand** — they are just strings
in the JSON.

A song that is blocked from embedding is reported and left out, because it
would sit in the list looking fine and refuse to play.

## Add a whole new playlist

1. Add an entry to `client/src/content/playlists.json` with `id`, `title`,
   `mood`, `lede`, `songs: []`, `removed: []`.
2. Add `{ "id": "...", "title": "..." }` to the `music` chapter's `branches`
   in `chapters.json`.
3. Run the importer above.
4. **Run `npm test`.** The layout tests read the real file, so a count the
   ring cannot hold fails immediately rather than on your phone.

If the test complains, run `node scripts/ring-check.mjs` to see which screen
and which measurement, and `node scripts/ring-check.mjs --find` to search
for numbers that fit. Paste the result into `CAROUSEL` in `layout.js`.

A playlist can use an existing mood, or a new one — see below.

## Add or change a mood colour

A mood is two places that must agree:

- `client/src/styles/music.css` — `:root[data-mood='party'] { ... }`, five
  custom properties: ink, glow, beat, wave time, wave rise.
- `client/src/hub/SubNodes.jsx` — `MOOD_INK`, the same ink as a hex string,
  because one is CSS and the other is a three.js material.

Then set `"mood": "party"` on the playlist. If the page does not change
colour, check `document.documentElement.dataset.mood` in the console — the
attribute is written by `Player.jsx` from whatever is playing.

---

## Change the words

All of them are in `client/src/content/`:

| Want to change | File |
|---|---|
| A chapter's title, lede, years, body | `chapters.json` |
| The branches inside a chapter | `chapters.json`, under that chapter |
| Games / The work / Blog | `rooms.json` |
| A photograph's caption | `captions.json` |
| The plain `/work` page | `work.js` |

Leaving `years` out of a chapter or room simply draws no years. That is how
"soon" was removed from Music, Games and Blog.

## Add photographs

1. Put the originals in `photos-raw/<chapter>/<branch>/`.
2. `node scripts/photos.js` — resizes, converts to WebP, writes thumbnails
   into `client/src/photos/`.
3. Caption them in `captions.json`.

They are imported at build time, so a new folder needs no registration.

---

## Move something in the 3D scene

**Everything is a number in `client/src/hub/layout.js`.** Do not nudge
positions inside components; they will be overwritten by the frame loop and
the tests will not see your change.

| Want to move | Constant |
|---|---|
| The playlist ring — size, height, how far in front, card size, camera | `CAROUSEL` |
| How far a drag turns that ring | `RING_PER_DRAG` |
| How two playlists stack in one slot | `stack`, inside `CAROUSEL` |
| The ring of chapters around the globe | `RING` |
| The photo cards inside a chapter | `FAN`, `cardFor` |
| How each branch drifts | `branchDrift` |
| Camera for the hub / a chapter / the playlists | `HOME_VIEW`, `branchView`, `ringView` |
| The zoom-out ladder to the universe | `STAGES`, `ZOOM_*` |
| Globe drag sensitivity and momentum | `TURN_PER_RADIUS`, `FLING_KEEP`, `TILT_RATE` |

After any of these: `npm test`. The suite projects the real layout at
thirteen viewport sizes and will name the screen and the measurement that
broke.

## Change how the playlist ring feels

Four numbers at the top of `client/src/hub/SubNodes.jsx`:

```js
const FLICK_TIME  = 0.55   // how long a flick glides
const FLICK_STOP  = 0.015  // below this it has stopped
const FOLLOW_HELD = 0.07   // how closely it tracks your finger
const FOLLOW_FREE = 0.22   // how softly it settles onto a slot
```

Bigger `FOLLOW_FREE` is looser and slower. Bigger `FLICK_TIME` glides
further. These are seconds, and the motion is integrated against real time,
so they mean the same thing at 30fps and 144fps.

**You have to judge these on a real machine.** The preview pane renders this
page at a few frames a second and will mislead you.

## Change the dance

`client/src/hub/pose.js` — pure maths, no React, returns the whole posture
for a given time. `BEAT` sets the tempo; the `OFFER_*` constants place the
arms when he is holding the playlists out. `Figure.jsx` only reads it.

---

## Add a chapter

1. Append to `chapters.json`.
2. `npm test` — a chapter whose branch count has no layout fails loudly,
   on purpose, rather than being approximated on screen.
3. Add a scene SVG at `client/public/scenes/<id>.svg` and reference it as
   `"scene": "/scenes/<id>.svg"`, or leave `scene` out.

Chapters are drawn in file order around the ring, which is chronological.

---

## When something looks wrong

| Symptom | Look at |
|---|---|
| Blank page | The console. A temporal dead zone passes the build and the tests. |
| The 3D never appears, canvas is 300×150 | The preview pane is hidden or backgrounded. Not a bug. |
| Colours do not change with the music | `data-mood` on `<html>` |
| A control is invisible but tabbable | Something faded with `opacity: 0` and no `visibility: hidden` — this class of bug has appeared four times |
| Cards or names overlapping | `npm test` first; then `node scripts/ring-check.mjs` |
| A song does nothing | It is probably region-blocked. `onError` skips it after a moment. |
| A deep link 404s in production | `404.html` — `scripts/post-build.js` makes it |

## Things worth not re-learning

- **Measure what the user sees, in the units they see it, with the code that
  actually ships.** Hand-copied formulas in a checker, world units instead
  of pixels, and a frozen preview pane have each produced a confidently
  wrong answer here.
- **A test against hardcoded fixtures cannot fail when the content grows.**
  Point tests at the real JSON.
- **Green CI and a matching bundle hash are not verification.** Open the
  page.
