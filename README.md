# jugnibishnoi

A personal site built as a little world: a globe with him standing on it,
and branches growing out of his head to the parts of twenty-three years —
farming, sport, college, building things, and a chapter of music you can
actually play.

Live at <https://rahulbishnoi2929.github.io/jugnibishnoi/>.

```bash
npm install
npm run dev        # http://localhost:5173/jugnibishnoi/
```

| | |
|---|---|
| `npm test` | 47 assertions over the geometry, two seconds, no runner |
| `npm run lint` | ESLint |
| `npm run build` | production build, plus the `404.html` Pages needs |
| push to `main` | builds and deploys itself |

---

## I want to change something

**Start with [docs/CHANGING.md](docs/CHANGING.md).** It is written as a list
of the changes you are likely to want — add songs, add a playlist, change a
mood colour, move something in the 3D, add photographs, add a chapter — with
the file to open and the thing that will tell you if you got it wrong.

Two shortcuts that cover most of it:

- **Words and lists** are JSON in `client/src/content/`. Nothing about
  content requires touching a component.
- **Every position, size and camera in the 3D** is a number in
  `client/src/hub/layout.js`, and `npm test` checks them at thirteen
  viewport sizes.

## Docs

| File | What |
|---|---|
| [docs/CHANGING.md](docs/CHANGING.md) | **how to make a change** — start here |
| [docs/NEXT.md](docs/NEXT.md) | what is built, and what to do next |
| [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md) | playing against Rahul — the plan, and the setup only he can do |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how it is built and why it has no backend |
| [docs/DESIGN.md](docs/DESIGN.md) | colour, type, layout, motion, the music section |
| [docs/PRD.md](docs/PRD.md) | what it is for, and what it refuses to be |
| [docs/CONTENT.md](docs/CONTENT.md) | the raw material: facts, photos, voice |
| [scripts/README.md](scripts/README.md) | the importers and layout tools |
| [DEPLOY.md](DEPLOY.md) | hosting and domain |

[PLAN.md](PLAN.md) is the original sketch, kept because it is where the idea
came from. The architecture it describes was never built — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for what exists.

## Stack

Vite · React 18 · React Three Fiber + three.js · plain CSS · YouTube IFrame
API · GitHub Pages. No backend, no database, no accounts.
