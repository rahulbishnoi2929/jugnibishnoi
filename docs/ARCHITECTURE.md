# ARCHITECTURE — "My Little World"

MERN, as requested. With one honest note up front.

---

## 1. Read this first

**Most of this site does not need a backend.** The journey, chapters, projects,
resume, links, and the vs-computer game are all static or client-side.

MongoDB + Express earn their place for exactly four things:

1. Writing blog posts from anywhere without a git push
2. Contact form submissions
3. Game leaderboard
4. Realtime rooms for playing with a friend (Socket.IO, not Mongo)

That is the whole backend. It is ~500 lines. If it ever grows past that,
something has gone wrong.

The consequence, and it is the important one: **the frontend must work when
the backend is asleep.** Free-tier hosts cold-start in 30s. Chapters, projects
and resume ship in the bundle. Only blog/contact/game hit the API, and each
degrades to a readable empty state instead of a spinner.

> If you would rather never run a server: MDX files in the repo + Vercel gives
> you the blog with zero infra, and the contact form becomes a Formspree
> endpoint. Faster, cheaper, less to maintain. MERN is the right call only if
> "write a post from my phone at 2am" is a thing you will actually do.
> Assuming yes — the rest of this doc is MERN.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + React 18 | already decided in PLAN.md |
| Routing | React Router v6 | — |
| Styling | Tailwind + CSS vars for tokens | tokens must be runtime-mutable for the accent lerp |
| 3D | React Three Fiber + drei | PLAN.md |
| Scroll | GSAP ScrollTrigger | PLAN.md |
| Data fetching | TanStack Query | caching + retry + loading states, free |
| Server | Node 20 + Express 4 | the E and N |
| DB | MongoDB Atlas (free M0) + Mongoose | the M |
| Realtime | Socket.IO | rooms are the whole feature; raw ws is not worth it |
| Auth | JWT in httpOnly cookie, one admin | no user table needed |
| Media | Cloudinary free tier | never put images in Mongo |
| Email | Resend | contact form notifications |
| Editor | react-markdown + a textarea | not a WYSIWYG. Markdown in, markdown out. |

**Not using:** Redux (Query + useState covers it) · GraphQL · Docker ·
Prisma · Next.js (would be a good call, but PLAN.md picked Vite and the 3D
scene is client-only anyway) · a UI kit.

---

## 3. Content: DB vs repo

| Content | Lives in | Why |
|---|---|---|
| Chapter copy + scene config | `client/src/content/chapters.json` | changes twice a year, coupled to 3D config |
| Projects | MongoDB | I add these often enough to want an admin form |
| Blog posts | MongoDB | the entire reason there is a backend |
| Books | MongoDB | quick add from phone after finishing one |
| Hackathons | MongoDB | few, but has photo arrays |
| Resume PDF | `client/public/resume.pdf` | it is a file |

---

## 4. Repo layout

Single repo, npm workspaces. Two deploy targets from one `git push`.

```
portfolio/
├── docs/                     PRD.md · DESIGN.md · ARCHITECTURE.md
├── PLAN.md                   the 3D concept
├── package.json              workspaces: client, server
│
├── client/
│   ├── public/               resume.pdf, favicon, og image
│   ├── src/
│   │   ├── main.jsx
│   │   ├── routes.jsx
│   │   ├── content/chapters.json
│   │   ├── styles/tokens.css        DESIGN §2 & §3 as CSS vars
│   │   ├── lib/
│   │   │   ├── api.js               fetch wrapper, base URL, credentials
│   │   │   └── accent.js            OKLCH lerp, sets --accent
│   │   ├── ui/                      Rail, Card, Tag, Button, Prose, Loader…
│   │   ├── journey/
│   │   │   ├── Journey.jsx          the spine
│   │   │   ├── Chapter.jsx
│   │   │   ├── scene/               R3F canvas, models, camera rig
│   │   │   └── StaticJourney.jsx    reduced-motion / no-JS version
│   │   ├── pages/
│   │   │   ├── Work.jsx             the escape hatch
│   │   │   ├── Projects.jsx  ProjectDetail.jsx
│   │   │   ├── Blog.jsx      Post.jsx
│   │   │   ├── Shelf.jsx     Hackathons.jsx
│   │   │   ├── Workshop.jsx
│   │   │   └── admin/               Login, Dashboard, PostEditor
│   │   └── game/
│   │       ├── engine.js            pure: board, moves, winner. No React.
│   │       ├── ai.js                minimax + alpha-beta over engine.js
│   │       ├── Board.jsx
│   │       ├── Solo.jsx             uses ai.js
│   │       └── Versus.jsx           uses socket
│   └── vite.config.js
│
└── server/
    ├── src/
    │   ├── index.js          express app + socket.io attach
    │   ├── db.js             mongoose connect
    │   ├── models/           Post.js Project.js Book.js Hackathon.js
    │   │                     Message.js Score.js
    │   ├── routes/           posts.js projects.js books.js hackathons.js
    │   │                     contact.js scores.js auth.js upload.js
    │   ├── middleware/       auth.js  ratelimit.js  errors.js
    │   └── game/rooms.js     in-memory Map. Socket.IO handlers.
    └── package.json
```

`game/engine.js` being pure and React-free is the one structural rule that
matters: the same file runs the AI in the browser and validates moves on the
server. Write it once.

---

## 5. Data models

Six collections. Mongoose schemas, `timestamps: true` on all.

```js
Post      { title, slug*, body, excerpt, coverUrl, tags[],
            status: 'draft'|'published', publishedAt, readingMins }

Project   { title, slug*, blurb, body, stack[], repoUrl, liveUrl,
            images[], featured: Bool, order: Number }

Book      { title, author, rating: 1..5, takeaway, coverUrl, finishedAt }

Hackathon { name, slug*, date, role, participants: Number, teams: Number,
            sponsors[], recap, photos[], liveUrl }

Message   { name, email, body, ip, read: Bool }          // contact form

Score     { game, name, score, createdAt }               // leaderboard
```

Indexes — the only three that matter:
```
Post:    { slug: 1 } unique,  { status: 1, publishedAt: -1 }
Score:   { game: 1, score: -1 }
Message: { createdAt: -1 }
```

No `User` collection. One admin, credentials in env. A users table for a
site with one user is the definition of speculative.

---

## 6. API

REST. Public reads are unauthenticated and cacheable; every write is admin-only.

```
GET    /api/posts                 ?tag= &limit= &page=    published only
GET    /api/posts/:slug
GET    /api/projects              ?featured=
GET    /api/projects/:slug
GET    /api/books
GET    /api/hackathons
GET    /api/hackathons/:slug
GET    /api/scores/:game          top 10
POST   /api/scores                rate limited, name+score validated
POST   /api/contact               rate limited 3/hour/IP → Resend + Message
GET    /rss.xml                   generated from published posts

POST   /api/auth/login            → httpOnly cookie
POST   /api/auth/logout
GET    /api/auth/me

-- everything below requires the cookie --
GET    /api/admin/posts           includes drafts
POST   /api/admin/posts
PATCH  /api/admin/posts/:id
DELETE /api/admin/posts/:id
POST   /api/admin/upload          → Cloudinary, returns url
   …same CRUD shape for projects, books, hackathons
GET    /api/admin/messages
```

Conventions, so nothing needs discussing later:
- Errors: `{ error: { message, code } }`, correct HTTP status. One error
  middleware, no per-route try/catch sprawl.
- Validation: `zod` at the route boundary. Never trust the client, including
  my own admin panel.
- Public GETs: `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- No versioning prefix. It is my site; I control both ends.

---

## 7. Auth

One admin. Do not build a user system.

```
ADMIN_EMAIL          in env
ADMIN_PASSWORD_HASH  bcrypt hash in env, never the plaintext
JWT_SECRET           in env
```

Login → verify bcrypt → sign JWT (7d) → set cookie
`httpOnly; Secure; SameSite=Lax; Path=/`.
Middleware reads the cookie on `/api/admin/*`. That is the entire auth system,
about 40 lines.

No refresh tokens, no roles, no password reset (I can redeploy an env var),
no localStorage tokens (XSS-readable).

Rate limit `/api/auth/login` to 5 attempts / 15 min / IP or the internet will
brute-force it within a week of going live.

---

## 8. Realtime game

`server/src/game/rooms.js` — a `Map`, nothing more:

```js
rooms = Map<code, { players: [socketId, socketId], state, turn, createdAt }>
```

Events:

| Direction | Event | Payload |
|---|---|---|
| c→s | `room:create` | `{ game }` → `{ code }` |
| c→s | `room:join` | `{ code }` → `{ state }` or error |
| c→s | `move` | `{ code, move }` |
| s→c | `state` | full board state (not a diff) |
| s→c | `opponent:left` | — |

Rules:
- Server owns the state. It validates every move with the shared
  `engine.js`. A client that sends an illegal move gets the authoritative
  state back and is ignored. Trusting the client is how you get a friend who
  wins every time.
- Send the **whole board**, not deltas. A Connect Four board is 42 cells.
  Delta sync is a bug factory for zero benefit.
- Sweep rooms older than 2h every 10 min. No persistence, no reconnect logic.
  Someone drops → the other player sees a message and can start over.

```js
// ponytail: rooms are in-memory, single instance only.
// Move to Redis adapter if the server ever scales past one process.
```

---

## 9. Deployment

```
  git push
     │
     ├──▶ Vercel      ← client/   static build, global CDN, prerendered
     │
     └──▶ Render      ← server/   Node web service (free or $7 starter)
                         │
                         ├──▶ MongoDB Atlas M0
                         ├──▶ Cloudinary
                         └──▶ Resend
```

- Client and server on separate origins → CORS allowlist of exactly the two
  known origins, `credentials: true`. No wildcard, ever, with cookies.
- Free Render tier sleeps. Two options: accept it (the site works without the
  API — see §1), or pay $7/mo. Do **not** build a cron job that pings your own
  server to keep it awake; that is a hack that will outlive its reason.
- Prerender `/`, `/work`, `/blog`, and each post at build time
  (`vite-plugin-prerender` or a small puppeteer script) so SEO and no-JS work.
  Rebuild hook fires on publish.

### Env

```
# server
MONGODB_URI  JWT_SECRET  ADMIN_EMAIL  ADMIN_PASSWORD_HASH
CLOUDINARY_URL  RESEND_API_KEY  CLIENT_ORIGIN  PORT

# client
VITE_API_URL  VITE_SOCKET_URL
```

Never a secret in `VITE_*` — those are compiled into the bundle and public.

---

## 10. Performance

The 3D is the risk. Everything else is a solved problem.

- Route-split everything. The 3D scene, the admin panel, and the game are
  three separate lazy chunks. A recruiter on `/work` should download none of
  them.
- Models: `.glb`, Draco, one texture atlas per chapter, `useGLTF.preload` on
  the *next* chapter only.
- Three scene tiers by device: desktop / tablet / mobile — fewer objects, lower
  `dpr`, shadows off. Decide from `matchMedia` + `hardwareConcurrency`, once,
  at load.
- Images through Cloudinary transforms (`f_auto,q_auto,w_1600`). Never serve
  an original.
- Budget check in CI: fail the build if the initial JS chunk exceeds 200KB
  gzipped.

---

## 11. Security checklist

Small site, but it is on the public internet with a write API.

- [ ] `helmet()` on Express
- [ ] CORS allowlist, not `*`
- [ ] `express-rate-limit`: contact 3/hr, login 5/15min, scores 10/hr
- [ ] zod validation on every body
- [ ] Blog HTML: render markdown with `react-markdown`, no
      `dangerouslySetInnerHTML`. If raw HTML in posts is ever needed,
      sanitize with `rehype-sanitize`.
- [ ] Upload: server-side type + size check (5MB), Cloudinary only
- [ ] Mongoose strict schemas (blocks operator injection in bodies)
- [ ] No stack traces in production error responses
- [ ] Cookies: httpOnly + Secure + SameSite
- [ ] `.env` gitignored; rotate anything ever pasted anywhere

---

## 12. Testing

Proportional. This is a portfolio, not a bank.

| What | How |
|---|---|
| `game/engine.js` | Vitest. Win detection, draw, illegal moves, AI never plays illegally. **This is the one place bugs are embarrassing in public.** |
| `lib/accent.js` | one test: lerp endpoints return the right colors |
| API routes | supertest on auth + contact + scores. Assert admin routes 401 without a cookie. |
| Everything else | click it |

No E2E suite. No coverage target. No component snapshot tests.

---

## 13. Build order

Mapped to PRD §9. Each row is deployable.

| Phase | Build |
|---|---|
| 0 | Repo + workspaces, Vite app, Vercel deploy, domain |
| 1 | `tokens.css`, `ui/` primitives, `/work` page, resume, links. **Ship it.** |
| 2 | `chapters.json`, `Chapter.jsx`, `Rail`, `StaticJourney`, real copy, mobile |
| 3 | Server: db, models, auth, posts CRUD, upload, contact. Admin editor. Blog pages. RSS. |
| 4 | R3F canvas, camera path, ScrollTrigger wiring, models, art pass |
| 5 | `engine.js` + tests, `ai.js`, `Board`, `Solo`, scores API |
| 6 | Socket.IO rooms, `Versus`, room codes |
| 7 | Shelf, hackathon pages, prerender, Lighthouse pass |

---

## 14. Deliberate shortcuts

Tracked, not forgotten:

```
ponytail: game rooms in-memory, single-process only → Redis adapter if scaled
ponytail: chapters in a JSON file, no admin UI → DB if editing gets annoying
ponytail: no comments, no user accounts → both are moderation/support work
ponytail: full-board sync over deltas → 42 cells, deltas buy nothing
ponytail: no refresh tokens, 7d JWT → single admin, re-login is fine
```
