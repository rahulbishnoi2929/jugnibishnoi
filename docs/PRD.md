# PRD — "My Little World"

A personal site that is not a resume page. It is a **place**: a scrollable life
journey with rooms hanging off it, where I can keep adding things forever.

Owner: Rahul · Age 23 · Status: pre-build
Extends [PLAN.md](../PLAN.md) (the 3D journey concept) with content, backend,
and everything that needs a database.

---

## 1. Why this exists

Three audiences, in priority order:

| # | Who | What they need | Time on site |
|---|---|---|---|
| 1 | Recruiter / client | Proof I can build. Fast. | 40 seconds |
| 2 | Someone who found my blog or a hackathon | Who is this guy | 4 minutes |
| 3 | Me | A place I own that I want to keep filling | years |

**The tension:** audience 1 wants a resume, audience 3 wants a playground.
Resolve it with an **escape hatch**, not a compromise — a persistent
`Just show me the work` button that jumps to a plain, fast projects + resume
view. Never dumb down the world for the impatient; give them a door.

Success = I still want to add to it 12 months from now. Everything else is
secondary.

---

## 2. The shape

```
             ┌──── THE JOURNEY (the spine, linear, scroll-driven) ────┐
             │                                                        │
  Soil ────▶ Grit ────▶ Campus ────▶ Build ────▶ Signal (now)
   │          │           │           │            │
   │          │           │           │            └──▶ Blog       (I write)
   │          │           │           └───────────────▶ Workshop   (games)
   │          │           └───────────────────────────▶ Shelf      (books)
   │          └───────────────────────────────────────▶ Trophy case
   └──────────────────────────────────────────────────▶ Roots      (farming)

  Off-spine, always reachable:  Projects · Resume · Links · Contact
```

The spine is a story. The rooms are a wiki. You enter through the story, you
come back for the rooms.

---

## 3. Chapters (the spine)

Five, not four. Each chapter has: a year range, one sentence, 2–5 artifacts
(photo / stat / link / quote), and one accent color the whole page inherits
while you are inside it.

### Ch.1 — Soil · farming, village, early years
The part nobody expects on a developer's site, which is exactly why it goes
first. Seasons, early mornings, watching things grow on a timescale you cannot
rush. Frame it honestly as where the patience came from — not as a metaphor
punchline.
Artifacts: field photos, a crop cycle, what it taught.

### Ch.2 — Grit · sports + school
Training, losing, showing up anyway. Sport is the only place most people learn
to lose in public.
Artifacts: sport(s) played, level reached, one loss worth remembering.

### Ch.3 — Campus · college + books
Where the input started outpacing the output. Books belong here because this is
when reading became a habit rather than a syllabus.
Artifacts: college, what I studied, 3 books that actually changed something.

### Ch.4 — Build · development + IIT training
Learning to make software. The training program is a distinct, dateable
milestone — say which IIT, which program, how long, what it unlocked.
Artifacts: first thing I ever shipped, the stack I settled on, the training.

### Ch.5 — Signal · hackathons, writing, now
Hosting three hackathons is the strongest single line on this site — that is
organizing, not attending. Give it numbers: participants, teams, sponsors, what
got built.
Artifacts: 3 hackathon cards with real numbers, the blog, what I am building now.

> **Open — needed before copy can be written:** exact years per chapter, which
> IIT + program name, the three hackathon names + participant counts, sport(s),
> college name, 3 books. Copy stays placeholder until then.

---

## 4. Features

Ranked. Ship top-down. Anything below the line is a "later" and is allowed to
never happen.

### P0 — the site is not real without these

| Feature | Notes |
|---|---|
| The journey | 5 chapters, scroll-driven, per PLAN.md |
| Timeline rail | fixed left: progress + labels + click-to-jump |
| Projects | grid + detail. Live link, repo, stack, one problem I solved |
| Escape hatch | `Just show me the work` → static fast page |
| Resume | PDF download + HTML version |
| Links | GitHub, LinkedIn, X, LeetCode, YouTube/IG if used |
| Contact | form → email + stored. Rate limited. |
| Mobile | reduced scene, not a broken one |
| Reduced motion | static chaptered page, full content |

### P1 — the reason it stays alive

| Feature | Notes |
|---|---|
| Blog | write, edit, publish, draft. Markdown. Tags. RSS. |
| Admin panel | one user (me). Posts, projects, image upload |
| Shelf | books read, rating, one line of what I took from it |
| Hackathon pages | one page each: photos, numbers, recap |

### P2 — the playground

| Feature | Notes |
|---|---|
| Workshop | index of small interactive things |
| Game vs computer | one game, done well, not four half-games |
| Game vs friend | room code, 2 players, realtime |
| Leaderboard | top scores, name + score only |

### P3 — only if I still care

Guestbook · newsletter · comments · light mode · site search · `/now` page ·
`/uses` page · now-playing widget.

---

## 5. Games — pick one, do it properly

Do **not** build a game engine. Build one game.

Recommendation: **Connect Four** or **Chain Reaction**. Both are: trivial rules,
hard to master, obviously 2-player, easy AI (minimax at depth 4 is a genuinely
annoying opponent), and render fine on a phone. Avoid anything needing physics,
sprites, or 60fps input.

- **vs Computer** — 100% client-side. No server, no account, no DB.
- **vs Friend** — host clicks *Play with friend*, gets a 4-letter code
  (`WHEAT`, `PLOW`), sends it on WhatsApp, friend types it in. No login. Room
  dies when both leave. Nothing persisted.
- **Leaderboard** — single-player only, and only if the player types a name.
  Never require it.

Anti-goals: accounts, matchmaking, ELO, chat, spectators, mobile app.

---

## 6. Content model

What I can create without touching code:

| Thing | Authored where | Fields |
|---|---|---|
| Blog post | admin editor | title, slug, body(md), tags, cover, status, publishedAt |
| Project | admin | title, blurb, stack[], repo, live, images[], featured |
| Book | admin | title, author, rating, takeaway, finishedAt |
| Hackathon | admin | name, date, role, participants, sponsors, recap, photos[] |
| Chapter copy | **repo file** | yearRange, title, body, artifacts[] |

Chapters live in a JSON file in the repo, not the DB. They change twice a year
and are tangled with 3D scene config — an admin UI for them is a feature nobody
uses twice. Promote to DB only if editing them ever actually annoys me.

---

## 7. Non-goals

Stated so they do not creep in at 2am:

- No multi-user accounts. One admin. That is me.
- No comments in v1. Moderation is a job.
- No third-party CMS. No Strapi, no Sanity, no Contentful.
- No i18n. No payments. No courses.
- No AI chatbot of me.
- No self-built analytics — Plausible/Umami exists.
- Not a design system. It is one site.

---

## 8. Quality bars

Pass/fail, not aspirations.

| Metric | Bar |
|---|---|
| First meaningful paint (3G, mobile) | < 2.5s |
| Total 3D asset payload | ≤ 4 MB, Draco-compressed |
| Escape-hatch page weight | < 300 KB |
| Lighthouse perf / a11y | ≥ 85 / ≥ 95 |
| Keyboard-only | full site reachable, incl. timeline jump |
| No-JS | resume + projects + posts readable (prerendered) |
| Blog publish time | < 60s from writing to live |

If the 3D cannot hit the payload bar, cut scenes — not the loading screen, not
mobile.

---

## 9. Phases

Each phase must be **deployable**. No phase ends with a half-built thing behind
a flag.

| # | Ships | Done when |
|---|---|---|
| 0 | Repo, deploy pipeline, domain, hello world | URL is live |
| 1 | Escape hatch: projects + resume + links, static | Recruiter-usable. **Site is already useful here.** |
| 2 | The spine in 2D: 5 chapters, rail, real copy, mobile | Story readable end to end |
| 3 | Backend + blog + admin | I published a post from my phone |
| 4 | 3D layer over the spine (PLAN.md phases 2–4) | Camera on rails, art pass |
| 5 | Workshop + one game vs computer | Playable |
| 6 | Game vs friend, realtime | Two phones, one room code |
| 7 | Shelf, hackathon pages, polish | — |

**Phase 1 before phase 2 is deliberate.** The boring page is the one that gets
you the job, and it takes a day. Build it first so the 3D can take three months
without costing anything.

---

## 10. Risks

| Risk | Reality | Mitigation |
|---|---|---|
| 3D asset work | Blender work, not code. ~70% of total effort. | Phase 1 ships without it. Use CC-licensed models. |
| Perpetual redesign | Site never launches | Phase 1 live in week one. Redesign a live site. |
| Blog with 0 posts | Empty section screams abandoned | Write 3 posts *before* building the blog. No posts → no blog section. |
| Game scope creep | Four unfinished games | One game. Written into non-goals. |
| Free-tier cold start | 30s wake on Render free | Escape hatch is static. Backend only for blog/contact/game. |
| Placeholder copy forever | "Lorem ipsum farming" ships | Copy is a P0 blocker on phase 2. |

---

## 11. Decisions still open

- [ ] Domain name
- [ ] Exact years, names, numbers (§3)
- [ ] Which game
- [ ] Realistic vs stylized 3D (PLAN.md open q)
- [ ] Blog in MongoDB, or Markdown files in repo? *(see ARCHITECTURE §3)*
- [ ] Time budget — this is a 3-month hobby-pace project, not a weekend
