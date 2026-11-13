# WHERE IT IS, AND WHAT IS NEXT

November 2026. Live at
<https://rahulbishnoi2929.github.io/jugnibishnoi/>.

---

## What is built

**The hub.** A globe with him standing on it, nine labelled branches
growing out of his head — six chapters and three rooms. Drag to turn, pinch
or scroll to zoom. Keep zooming out and it climbs a ladder of scales to the
observable universe and back. Each branch drifts at its own rate.

**Five chapters with something in them.** Soil, Grit, Campus, Build, Signal.
Campus has photographs, grouped into branches, with a viewer.

**Music.** The sixth chapter, and the largest thing here.

- Nine playlists, 315 songs, played through YouTube's iframe so nothing
  copyrighted lives in the repo and the rights holders are paid.
- The playlists are a ring you turn, two cards to a slot.
- A dock that survives navigation: play/pause, seek, next, previous,
  shuffle, repeat, stop, and a queue you build by picking songs.
- The page takes the mood of what is playing — colour, waves, and the
  music video itself playing full-bleed behind the site, dimmed.

**The escape hatch.** `/work` — no 3D, no motion, just the facts. Linked
from every screen, because not everyone wants a globe.

**A journey page.** `/journey` — the same five chapters told as a flat,
scrollable page.

**Games.** Chess at three strengths against a computer that searches to a
time budget and thinks in a worker so the site does not freeze, with a
clock — no clock, 1, 2, 10 or 30 minutes, and you lose if it runs out —
and Connect Four. Both are pure engines with their own tests; the room loads a game only
when you pick it, so neither costs anything to a visitor who does not play.

**47 tests** over the geometry, run in two seconds by `node`, asserting in
screen pixels at thirteen viewport sizes.

---

## Next, in the order I would do it

### 1. ~~The bundle is too big~~ — settled, November 2026

The 990KB chunk was mostly other people's code. Measured gzipped:
three.js is 171KB on its own, react 60, drei and fiber 51 — and the
site's own 3D is 49. The PRD's 200KB budget was written before the site
became a three.js site; it cannot be met while the globe exists, and the
globe is the site.

What was actually wrong got fixed instead:

- **Every push re-downloaded three.js.** It all shipped as one chunk, so
  a returning visitor fetched the whole engine again whenever the site
  changed. The libraries live in their own chunks now, which change only
  when a dependency is deliberately updated.
- **The plain pages loaded the 3D engine.** The first attempt at that
  split made it worse: Vite's lazy-import helper and React's JSX runtime
  were left unclaimed, Rollup put them in the r3f chunk, and r3f imports
  three.js — so /work, the page that exists for people who do not want a
  globe, fetched 300KB of globe. The chunking claims them for React now.

Where it landed, gzipped: **/work and /journey load 75KB**, two files.
**The hub's first visit is 349KB**, and a returning visitor after a push
downloads only the 49KB that changed.

### 2. Content gaps

- **Music has no scene SVG.** Every other chapter has one; Music declares
  none, so nothing is broken, but it is the odd one out.
- **Volleyball and shooting photo sets are empty.**
- **`captions.json` is thin** — the when, where, what and why of most
  photographs are unwritten, and the viewer shows them.
- **Soil, Grit, Build and Signal have no photographs**, so their branches
  are frames with nothing in them.

### 3. The figure

He is boxes. A Mixamo-rigged GLB was started and the textures were already
compressed from 6.7MB to 0.55MB. Binding `pose.js` to real bones needs an
axis remap calibrated against whatever the rig exports — a day's careful
work, and the single biggest visual upgrade available.

### 4. Play against Rahul

Chosen, designed and not built: a challenge, a notification, and a game
that survives a closed tab. It needs a Supabase project, which needs an
account, which needs him — the twenty minutes of setup and the schema are
written out in [MULTIPLAYER.md](MULTIPLAYER.md). Nothing else is blocked on
it, and chess against the computer must keep working when it is down.

### 5. Two duplicate songs and a bad title

- "Dil Tu Hi Bataa" is in Personal Favourites twice, at 5 and 23.
- "3:59 AM" is in Rap twice, at 2 and 7.
- Personal Favourites #27 reads just "KK" — the artist-strip ate the title.

Left alone deliberately: they are his lists, and deleting from someone's
favourites is not a thing to do unasked.

### 6. Smaller things

- Desktop chapter labels still overlap by about 65px at some widths; the
  front-only rule that fixes it is applied on phones only.
- "Plainly" still sits under The work as its years, which is real copy
  rather than a placeholder — remove it if it reads as one.
- The music section's blur over the whole window is the most expensive
  thing on the page; if a phone runs hot during a song, turn it down first.

---

## Decisions worth making before building more

- **Does Music stay a chapter, or become its own room?** It has `years:
  "soon"` removed and no place on a timeline that is otherwise
  chronological. It sits oddly between the two.
- **Blog and Games are nodes with nothing behind them.** Either build one
  or take the node down; a branch that goes nowhere twice teaches people
  not to click branches.
- **Who else will ever edit this?** If the answer stays "nobody", the
  JSON-in-the-repo model is right and should be left alone. If it becomes
  "someone non-technical", that is the moment a backend earns its keep —
  and not before.
