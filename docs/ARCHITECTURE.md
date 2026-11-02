# ARCHITECTURE

How the site is actually built, as of November 2026.

An earlier version of this file described a MERN stack — Express, MongoDB,
Socket.IO, an admin panel, a login. None of it was built, and none of it is
needed. What exists is a static site: one React app, no server, no database,
no accounts. That turned out to be the right size for it, and this file now
describes the thing rather than the plan.

---

## 1. Read this first

Three facts explain most of the code.

**There is no backend.** Everything ships as static files to GitHub Pages.
Content lives in JSON in the repo and is imported at build time. The only
things that happen at runtime over the network are YouTube's iframe player
and its thumbnail CDN.

**`client/src/hub/layout.js` is the source of truth for where things are.**
Every position, size, camera and radius in the 3D scene is a number in that
file or a function over it. It imports React from nowhere, so the tests run
it under plain `node`. If you want to move something, you move it there, not
in a component.

**The preview pane lies about motion.** The in-editor browser renders this
page at one to five frames a second, so anything timed — a flick, a drift, a
transition — cannot be judged there. More than once a confident measurement
taken in it turned out to be an artifact. Geometry is checked by tests;
feel is checked on a real machine.

---

## 2. Stack

| | |
|---|---|
| Build | Vite 6, npm workspaces (one workspace: `client`) |
| UI | React 18, React Router |
| 3D | three.js r169, React Three Fiber v8, drei v9 |
| Styles | plain CSS, custom properties, no framework |
| Audio | YouTube IFrame Player API |
| Tests | `node:assert` + plain `.mjs` files, no runner |
| Lint | ESLint 9 flat config |
| Host | GitHub Pages, deployed by Actions on push to `main` |

No Tailwind, no state library, no test framework, no backend. Each of those
is an absence on purpose: the site is one page of 3D and some JSON.

---

## 3. Repo layout

```
portfolio/
├── docs/                   PRD · DESIGN · ARCHITECTURE · CHANGING · NEXT · CONTENT
├── scripts/                content importers and layout tools (see scripts/README.md)
├── photos-raw/             originals; never shipped, see scripts/photos.js
├── eslint.config.mjs
│
└── client/
    ├── public/             favicon, scene SVGs, models
    └── src/
        ├── main.jsx        router, and MusicProvider wrapped around it
        │
        ├── content/        ALL the words and lists live here
        │   ├── chapters.json    the six chapters and their branches
        │   ├── rooms.json       Games, The work, Blog — the non-chapter nodes
        │   ├── playlists.json   nine playlists, 315 songs
        │   ├── captions.json    per-photograph captions
        │   └── work.js          the plain-text escape hatch page
        │
        ├── hub/            the 3D world — the globe, him, the branches
        │   ├── layout.js        every number. Pure. No React.
        │   ├── layout.test.mjs  47 tests over layout.js and pose.js
        │   ├── pose.js          the dance, as maths. Pure. No React.
        │   ├── Hub.jsx          orchestration: drag, zoom, routing, camera
        │   ├── Figure.jsx       the body, driven by pose.js
        │   ├── Globe.jsx  Cosmos.jsx   earth, and the zoom out to the universe
        │   ├── Nodes.jsx        the chapter dots and the branches to them
        │   ├── SubNodes.jsx     the cards inside a chapter, incl. the playlist ring
        │   ├── Panel.jsx  Plate.jsx  Gallery.jsx   the reading panel and photos
        │   ├── cosmos.js  shaders.js  dispose.js   support
        │   └── india.json  india-states.json       borders drawn on the globe
        │
        ├── music/          the player, which outlives the page you started it on
        │   ├── Player.jsx       MusicProvider + the dock. Owns the YouTube iframe.
        │   ├── Playlist.jsx     one playlist, open
        │   ├── Waves.jsx        the moving water behind the page
        │   ├── context.js       kept apart so editing the player survives hot reload
        │   └── youtube.js       the IFrame API, loaded once
        │
        ├── journey/        the flat, scrollable telling of the same five chapters
        ├── game/           tic-tac-toe. engine.js is pure and tested.
        ├── pages/Work.jsx  the escape hatch: no 3D, no motion
        ├── lib/            playlists.js, media.js, asset.js — content accessors
        └── styles/         tokens.css, app.css, hub.css, music.css, journey.css
```

---

## 4. The three rules worth keeping

**Pure modules for anything measurable.** `layout.js`, `pose.js`,
`game/engine.js` contain no React and no three.js objects in their public
shapes beyond vectors. That is what lets `npm test` run them in node and
assert in screen pixels. When something visual needed checking and the maths
lived inside a component, it could not be tested — so it was moved out. Do
the same with anything new.

**The music player lives above the router.** `MusicProvider` wraps
`<Routes>` in `main.jsx`. A song has to survive leaving the page it was
started from, and anything inside a route unmounts on navigation. The
YouTube iframe is created once into a fixed layer and never re-parented,
because re-parenting an iframe reloads it. That single constraint explains
the shape of `Player.jsx`.

**Content is data, not code.** Adding a playlist, a chapter, a photograph or
a caption is a JSON edit. If you find yourself editing a component to add
content, something is in the wrong place.

---

## 5. How the 3D is organised

`Hub.jsx` is the orchestrator and the only place that knows about the
router. It owns:

- **the camera** — a target `view` chosen from the route, flown to with
  frame-rate-independent damping
- **the drag** — one pointer handler that means different things depending
  on where you are: on the hub it turns the ring of chapters; inside the
  playlists it turns the ring of cards; vertical always tilts
- **the zoom** — wheel and pinch, clamped, and past a threshold it hands off
  to `Cosmos.jsx` and the ladder out to the observable universe
- **refs shared downward** — `bob` (how far his head is off its rest),
  `spin` (where the turntable is), `carousel` (where the playlist ring is).
  These are refs, not state, because they change every frame and nothing
  above them should re-render.

Components below it are mostly leaves that read those refs in `useFrame` and
write to three.js objects directly. There is very little React state in the
3D tree on purpose; sixty re-renders a second is not a thing to want.

---

## 6. How the music works

```
MusicProvider (above the router, in main.jsx)
├── .stage        the YouTube iframe, full-bleed behind the page, dimmed
├── <Waves/>      SVG water, coloured by the mood
├── {children}    the whole site
└── <Dock/>       the controls, bottom right
```

- **State** lives in `MusicProvider`: what is playing, the clock, shuffle,
  repeat, and the queue. The queue holds `{id, index}` pairs so queuing from
  one playlist while standing in another plays the right song.
- **The handlers are built once.** YouTube gets its callbacks at player
  creation and never again, so they read the current track through refs
  (`live`, `move`, `after`) rather than closing over state that was correct
  three songs ago.
- **Moods** are a `data-mood` attribute written to `document.documentElement`
  from whatever is playing. Every colour in the music section hangs off it.
  The attribute existed in CSS for weeks before anything set it, and the
  whole feature was dead until it did — check it first if colours look wrong.
- **A song that will not play** (region-blocked, or taken down since import)
  fires `onError`, which is treated as a song that ended early so the list
  carries on. After three in a row it gives up rather than racing through a
  blocked playlist.

---

## 7. Testing

```bash
npm test     # 47 assertions, ~2 seconds, no runner
npm run lint
npm run build
```

`client/src/hub/layout.test.mjs` is the interesting one. It reads the real
`chapters.json` and `rooms.json`, projects the real layout functions through
a real `THREE.PerspectiveCamera` at thirteen viewport sizes, and asserts in
**screen pixels**: cards clear of the reading panel, names not overlapping,
the front of the playlist ring worth tapping, his head on screen, nothing
under the bottom sheet.

Two lessons are baked into it and worth not re-learning:

1. **Assert against real content, not fixtures.** An earlier version used
   hand-typed lists, so adding a sixth chapter could not fail anything.
2. **A checker with its own copy of the geometry checks the wrong thing.**
   The sweep that placed the old card fan had a hand-copied formula and
   reported 21px of clearance for a layout that shipped with 10px of
   overlap. Tools in `scripts/` import the real functions.

What the tests do **not** cover: anything React, anything that runs in a
browser, and anything about how motion feels. A blank page caused by a
temporal dead zone passed both the build and the whole suite. Load the site.

---

## 8. Deployment

Push to `main`. `.github/workflows/pages.yml` builds and publishes to GitHub
Pages at `https://rahulbishnoi2929.github.io/jugnibishnoi/`.

Two details that will bite otherwise:

- **The base path is `/jugnibishnoi/`.** It is set in `vite.config.js` and
  the router is given `import.meta.env.BASE_URL`. A route that resolves one
  level too high is almost always this.
- **`npm run build` copies `index.html` to `404.html`.** Pages has no SPA
  rewrite, so a deep link like `/c/music/party` is served the 404 page,
  which is the app, which then routes correctly. `scripts/post-build.js`
  does it.

The dev server's SPA fallback means **any** URL returns 200 with the app
HTML. Probing for a missing asset with `fetch` therefore proves nothing —
check the filesystem.

---

## 9. Deliberate shortcuts

Things that are the way they are because the simple version was enough, with
what would have to change if it stops being enough.

| Shortcut | When to revisit |
|---|---|
| No backend; content is JSON in the repo | When someone other than Rahul needs to edit it |
| No test runner; tests are `.mjs` files run by node | When there are enough to need filtering or watch mode |
| The hub bundle is ~990KB (278KB gzipped) | It is over the PRD's 200KB budget. Code-splitting the cosmos and the music section is the obvious first cut. |
| The 3D figure is boxes, not a rigged model | A Mixamo-rigged GLB was started; `pose.js` would bind to real bones with an axis remap |
| Photographs are committed as WebP in `client/src/photos` | If the set grows past a few hundred, they want a CDN |
| `prefers-reduced-motion` stops animation but the 3D still renders | A genuinely static fallback is `pages/Work.jsx`, which is linked from everywhere |
