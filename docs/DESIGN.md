# DESIGN — "My Little World"

The design system. One idea, executed consistently.

---

## 1. The idea

**The palette is the timeline.**

The site starts the color of soil and ends the color of a terminal. As you
scroll through 23 years, the accent color migrates from wheat-gold through clay
and ink-blue into terminal-green. Nobody consciously notices; everybody feels
that they travelled somewhere.

This gives one free thing: any component can read `--accent` and be
chapter-aware without knowing what a chapter is.

Tone: **warm, earthy, hand-made** — not the standard purple-gradient dev
portfolio. Farming is the differentiator; the design should look like it came
from someone who has been outside.

---

## 2. Color

### Base (constant, all chapters)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0F100D` | page background, soil-black |
| `--bg-raised` | `#1A1B16` | cards, panels |
| `--ink` | `#F2EFE4` | primary text, unbleached paper |
| `--ink-dim` | `#A8A498` | secondary text, captions |
| `--line` | `#2C2E26` | borders, rules, dividers |

Dark by default and only. A light mode doubles every visual decision for a
toggle 4% of visitors press. It is in P3 for a reason.

### Chapter accents (interpolated on scroll)

| Chapter | Token value | Name |
|---|---|---|
| 1 Soil | `#D4A72C` | wheat |
| 2 Grit | `#E2703A` | clay |
| 3 Campus | `#5B8DBE` | ink blue |
| 4 Build | `#3DDC97` | terminal green |
| 5 Signal | `#B06AF0` | signal violet |

```css
:root { --accent: #D4A72C; }        /* JS updates this on scroll */
```

Scroll progress lerps `--accent` in **OKLCH**, not hex — hex/RGB interpolation
runs colors through mud (wheat→blue passes through grey-brown). One line:

```js
el.style.setProperty('--accent', `oklch(from ${a} l c h)`) // or use culori's interpolate
```

### Rules

- Accent is for **one thing per screen**: the active rail node, a link
  underline, a focus ring. Never a background fill, never body text.
- Contrast: body text ≥ 7:1 on `--bg`. Accent-on-bg ≥ 4.5:1 — check clay
  (`#E2703A`) and violet, they are the tight ones.
- Never rely on accent alone to convey state. Active rail node also grows and
  gets a label.

---

## 3. Type

| Role | Face | Fallback | Why |
|---|---|---|---|
| Display | **Fraunces** (var, opsz+SOFT) | Georgia, serif | Warm, agricultural, has weight. Not another Inter site. |
| Body | **Inter** | system-ui | Boring on purpose. Reads at 16px on a phone. |
| Mono | **JetBrains Mono** | ui-monospace | Years, stats, code, room codes |

Serif = memory. Mono = machine. Body = the connective tissue between them.
That contrast *is* the story of the site.

### Scale

Fluid, `clamp()`, no breakpoint jumps:

```css
--step--1: clamp(0.83rem, 0.8rem + 0.15vw, 0.9rem);
--step-0:  clamp(1rem,    0.95rem + 0.25vw, 1.13rem);
--step-1:  clamp(1.4rem,  1.2rem + 1vw,     1.9rem);
--step-2:  clamp(2rem,    1.5rem + 2.5vw,   3.2rem);
--step-3:  clamp(2.8rem,  1.8rem + 5vw,     6rem);   /* chapter titles */
```

Measure: **62ch max** on body copy. Non-negotiable — full-width paragraphs are
the fastest way to make a site feel amateur.

Line height: 1.6 body, 1.05 display. Chapter titles get `letter-spacing: -0.02em`.

---

## 4. Layout

```
┌────────┬──────────────────────────────────────────────┬─────────┐
│  RAIL  │                                              │  work   │  ← escape
│  72px  │              CONTENT / CANVAS                │  hatch  │    hatch
│        │                                              └─────────┘
│  ●2003 │   ┌────────────────────────────┐
│  ●2016 │   │  text overlay, max 62ch    │
│  ○2020 │   │  offset left, not centered │
│  ○2022 │   └────────────────────────────┘
│  ○2024 │
│   ▓▓░░ │  ← progress fill
└────────┴──────────────────────────────────────────────────────────┘
```

- 8px spacing base. Only use 4/8/16/24/40/64/96.
- Content offset **left**, not centered — leaves the right side of the 3D
  scene visible. Centered text over 3D always fights the art.
- Rail: 72px desktop, collapses to a 4px top progress bar under 900px.
- Full-bleed canvas behind, HTML above. Content is real DOM, always.

### Breakpoints

`900px` (rail collapses, 3D scene simplifies) and `600px` (single column,
scene drops to lowest tier). Two breakpoints. That is enough.

---

## 5. Motion

| What | Spec |
|---|---|
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` for UI. Scroll-linked = linear. |
| UI transitions | 180ms. Anything over 300ms feels broken. |
| Chapter accent lerp | continuous, tied to scroll, no duration |
| Text entry | fade + 12px rise, staggered 60ms, once |
| Scroll → camera | GSAP ScrollTrigger, `scrub: 1` (1s catch-up = weight) |

**Scroll hijacking is banned.** Scroll drives the camera; scroll never
*becomes* the camera. If a user flicks to the bottom, they land at the bottom.

### `prefers-reduced-motion`

Not a degraded version — a **different, complete** version:
- No canvas at all (do not even load the GLBs — saves 4MB)
- Chapters become stacked full-width sections with the chapter photo as a
  static hero
- Accent color changes instantly at section boundaries, no lerp
- Every word of copy is present

This is also the no-JS fallback and the low-end-Android fallback. One
alternative view, three jobs.

---

## 6. Components

Small set. Reuse hard.

| Component | Notes |
|---|---|
| `<Rail>` | Fixed nav. Node = dot + year + label. Active = filled + accent + scale 1.4. Buttons, not divs — keyboard reachable. |
| `<Chapter>` | Section wrapper. Owns its accent + scroll trigger. |
| `<Artifact>` | Photo / stat / quote card. One variant prop, three looks. |
| `<StatBlock>` | Mono number + label. `340 participants` / `3 hackathons` |
| `<Card>` | Project, post, book, hackathon. Same card, different content. |
| `<Tag>` | Mono, uppercase, 11px, `--line` border. |
| `<Button>` | Two variants: solid accent, ghost. Nothing else. |
| `<Prose>` | Markdown wrapper. All blog typography lives here, once. |
| `<Loader>` | Real percentage from R3F `useProgress`. No fake bar. |

### Card anatomy (used four ways)

```
┌────────────────────────────────┐
│ [16:9 image, lazy, blur-up]    │
│                                │
│ TAG  TAG                       │  ← mono, dim
│ Title in display face          │
│ One line of what it was.       │  ← --ink-dim
│                     ↗ live  ⌥  │  ← accent on hover only
└────────────────────────────────┘
```

Border `1px --line`. Hover: border → `--accent`, translateY(-2px). No shadow,
no glow, no scale. Restraint reads as expensive.

---

## 7. Photography & imagery

The farming and sports photos are the single biggest asset this design has —
real, personal, non-stock. Treat them as the art.

- Full-bleed where possible, never in a rounded box
- Slight desaturation + warm grade so mixed sources feel like one set
- `<img loading="lazy" decoding="async">`, AVIF with JPEG fallback,
  blur-up placeholder (20px base64)
- Every image gets real alt text. "Photo" is not alt text.
- 1600px wide max. Nobody needs your 4000px phone photo.

---

## 8. The escape hatch

The one page that is deliberately, aggressively plain:

- No canvas, no scroll effects, no fonts beyond system + Inter
- Name, one line, links, projects list, resume button, contact
- Under 300KB, prerendered HTML, loads instantly on hotel wifi
- Reachable from a persistent top-right button on every page, and directly at
  `/work`

Do not be precious about this page. Its job is to be boring in 40 seconds.

---

## 9. Accessibility (non-negotiable)

- Focus visible on everything: `2px solid var(--accent)`, `outline-offset: 3px`
- Skip link to main content, first tab stop
- Rail nodes are `<button>` with `aria-current="true"` on active
- Canvas is `aria-hidden="true"` — it carries zero information the DOM lacks
- Game board is a keyboard-playable grid with `aria-label` per cell. If the
  game cannot be played by keyboard, it is not finished.
- Live regions for game state ("Your turn", "You won")
- Test: unplug the mouse and use the whole site.

---

## 10. Anti-patterns for this project

Explicitly banned, because they are the default:

- Purple/blue gradient hero
- Glassmorphism cards
- A typewriter effect on "I am a Full Stack Developer"
- Animated blob backgrounds
- Skill bars with percentages ("HTML 90%")
- Auto-playing audio
- A custom cursor that follows with a lag
- "Scroll down" bouncing chevron
- Confetti on form submit
- Any hero copy containing "passionate" or "turning coffee into code"

---

## 11. The music chapter

Built after the rest, and the one place the design system bends on purpose.

### The page takes the colour of the song

Every other chapter wears its accent. Music wears whatever is playing. Nine
playlists, nine moods, each one five custom properties on
`:root[data-mood='…']`:

| | ink | what it is |
|---|---|---|
| `disco` | `#ff4d9d` | Chatpate — the loud ones |
| `calm` | `#6fd3c7` | Anytime |
| `warm` | `#ffa07a` | Lovable |
| `memory` | `#d9b26a` | Yaadaan |
| `hard` | `#c8f03c` | Rap |
| `intense` | `#ff5a3c` | High Intensity |
| `favourite` | `#9d8cff` | Personal Favourites |
| `iconic` | `#ffb000` | HR Iconic — Haryana, loud |
| `party` | `#3ad6ff` | Party |

Beyond the ink each mood carries a glow, a beat strength, and two numbers
for the water: how fast it crosses and how high it rises. Adding a mood is
therefore five numbers and a hex, not a component.

The attribute is written to the document from whatever is playing, and
cleared on stop. Everything else — the wash, the waves, the card tints, the
track titles, the seek bar — reads it. It is a single switch the whole
section hangs off, which is also its failure mode: it existed in CSS for
weeks before anything set it, and the entire feature was invisible.

### Three layers behind the page

1. **The video.** The music video itself, full-bleed, cover-fitted to any
   window shape, dimmed to about a fifth so a page can be read over it.
   It is the YouTube player — the same iframe that is making the sound,
   not a copy — which is why it can never be moved in the DOM.
2. **The wash.** Two radial gradients in the mood's glow, pulsing on the
   moods that said they were loud.
3. **The waves.** Three SVG layers at different speeds and heights. They
   belong to the bottom of the window, unless a reading sheet is over
   them, in which case they sit on the floor of the scene instead.

While a song plays the reading panel thins and blurs so the video comes
through it. Every other chapter keeps its solid page.

### The playlists are a ring

Nine cards on a circle in front of him, two to a slot, one above the other.
Drag sideways and it turns — the card at the front comes square to you at
full size, its neighbours stay turned away at an angle, and the rest are
behind him and not drawn at all.

This replaced two rows of nine laid flat, which was the right answer for six
and the wrong one for nine: the sweep that placed them ended with four
pixels of clearance on a tablet and names shrunk until they wrapped. A ring
does not try to show nine things at once.

Rules that make it read as a ring rather than a stack:

- Only the card at the front opens. Clicking one at the side **turns the
  ring to it** — that is what clicking it meant.
- Nothing snaps. Where the ring is meant to be and where it is drawn are two
  numbers, and the second only ever eases toward the first, so a flick, a
  drag and a settle all arrive through the same curve.
- Neighbours must not lie across each other. Checked in the test suite,
  because the first numbers that passed everything else looked like a pile.

### The dock

Bottom right, and it outlives the page you started the song on. Artwork,
title, six controls, and a seek bar across its own full width — it was
48 pixels wide squeezed between the title and the buttons, which is not
something you can take hold of.

The bar does not fight you: while you hold it, it follows your finger and
the clock does not touch it, and the song is told once, when you let go.

### What it refuses to do

- **No autoplay.** The first sound always follows a tap. This is also what
  makes it work on a phone.
- **No files.** The songs are commercial recordings; they stream from
  YouTube, so the rights holders are paid and nothing copyrighted is in
  this repository.
- **No pretending.** When a song will not play — region-blocked, or taken
  down since it was added — the list moves on rather than sitting on a
  title doing nothing.
