# 3D Portfolio — Plan

A scroll-driven 3D website telling my life story as a journey:
**school → college → the college journey → after college.**

Status: planning only. No code yet.

---

## 1. Concept

The page scrolls, and scroll position drives a camera moving along a fixed path
through one continuous 3D world. Each life era is a "station" along that path.

```
scroll ──▶ camera moves along a curve

  0–20%    School             classroom / school bus / playground
  20–45%   College            campus gate, hostel, lecture hall
  45–75%   The journey        projects, late nights, internships
  75–100%  After college      work, current me, contact
```

Key decisions made so far:

- **Left vertical timeline rail** — fixed on the left edge, always visible.
  Acts as three things at once: progress indicator, chapter label, and
  click-to-jump navigation.
- **Bruno Simon aesthetic** — playful low-poly, flat bright colors, soft
  shadows. Not photorealistic.
- **Linear, not free-roam** — a life timeline is linear, so scroll beats
  free exploration. No driving-a-car mechanic.

## 2. Layout

```
┌──────────┬─────────────────────────────────┐
│          │                                 │
│  TIME    │                                 │
│  LINE    │      3D canvas (full bleed)     │
│  RAIL    │                                 │
│          │      + HTML text overlay        │
│  ● 2010  │                                 │
│  ● 2018  │                                 │
│  ○ 2020  │                                 │
│  ○ 2024  │                                 │
│          │                                 │
└──────────┴─────────────────────────────────┘
```

- 3D lives on a `<canvas>` behind everything.
- All readable content (headings, paragraphs, photos) is **plain HTML
  overlaid on top** — keeps it accessible, selectable, and SEO-friendly.
- The rail is HTML too, not 3D.

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + React | fast, simple |
| 3D | Three.js via React Three Fiber | component-driven, less boilerplate |
| Helpers | @react-three/drei | camera rigs, loaders, scroll controls |
| Scroll | GSAP ScrollTrigger | precise scroll → camera mapping |
| Styling | Tailwind CSS | quick, no CSS files to manage |
| Models | `.glb` + Draco compression | smallest payload |
| Hosting | Vercel or Netlify | free, git-push deploy |

## 4. Build phases

**Phase 1 — Skeleton (no 3D)**
- Vite + React + Tailwind running
- Left timeline rail, static, with the four eras
- Four full-height content sections with placeholder text
- Scroll updates the active rail node

**Phase 2 — Camera on rails**
- Add R3F canvas with placeholder boxes for each era
- Define the camera path (a curve through the four stations)
- Wire ScrollTrigger so scroll drives camera position + look-at
- Goal: movement feels right *before* any real art exists

**Phase 3 — Content**
- Real copy for each era
- Photos / small memories per station
- Fade-in transitions tied to scroll progress

**Phase 4 — Art pass**
- Replace placeholder boxes with real low-poly models
- Lighting, colors, fog, atmosphere per era
- Ambient sound (optional, off by default)

**Phase 5 — Polish**
- Loading screen with real progress
- Mobile fallback
- Performance pass
- Deploy

## 5. Assets

This is the real work — not the code.

- Source free CC models from Sketchfab / Poly Pizza / Quaternius
- Or build simple ones in Blender (low-poly is forgiving)
- Every model exported as `.glb`, Draco-compressed
- Budget: **3–5 MB total** for the whole site

Per-era asset list — to be filled in:

- [ ] School —
- [ ] College —
- [ ] Journey —
- [ ] After college —

## 6. Constraints to respect

1. **Mobile is half the traffic.** Plan a reduced scene (fewer objects, lower
   pixel ratio) from day one, not as an afterthought.
2. **Load time kills 3D sites.** If it takes 12s to load, the visitor is gone.
   Real loading screen, hard asset budget.
3. **Always give an escape hatch.** A "skip to resume" link for people who
   just want the facts.
4. **Accessibility.** Respect `prefers-reduced-motion` — serve a static
   version to anyone who asks for it.

## 7. Open questions

- [ ] Time budget — a weekend, or a few weeks?
- [ ] Any Blender / 3D experience, or starting from zero?
- [ ] Main audience — recruiters, or a personal creative project?
- [ ] Realistic scenes, or abstract / stylized?
- [ ] Exact years and milestones for each era
- [ ] Domain name

## 8. Reference

Inspiration:
- https://bruno-simon.com/ — the low-poly playful benchmark
- https://henryheffernan.com/ — 3D room portfolio
- The Monolith Project — scroll-driven story across 13 scenes

Learning:
- https://svilenkovic.com/3d/how-to-make-scroll-driven-3d — the exact mechanic
- https://tympanus.net/codrops/2026/04/20/interactive-storytelling-for-the-web-building-immersive-stories-with-timelines-3d-and-layered-scenes/
- https://threejs-journey.com/ — Bruno's own course (paid)

Code to read:
- https://github.com/tairqaldy/three.js-3d-portfolio-website
- https://github.com/topics/3d-portfolio-website
