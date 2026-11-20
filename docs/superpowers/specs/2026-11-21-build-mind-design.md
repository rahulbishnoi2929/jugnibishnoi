# Build: inside my head

## Intent

Build is the chapter about what I make. Opening it should feel like being let
into the head the chapters grow out of: the world falls away and there is only
a transparent skull, neurons firing through it, and the things I have actually
built drifting inside. Tap one and you get the real details.

It replaces the IIT Ropar story, which is a one-month internship and not the
work.

## Goals

- Tap **Build** → a transition → the screen holds only the skull.
- The skull is transparent: you see through it to the brain.
- Neurons: branching paths inside the cranium with pulses of light travelling
  along them, constantly.
- 2–3 real projects travel slowly through the brain as labelled glowing
  markers. Tapping one opens its details.
- Built the way the solar system, galaxy and universe are: procedural, seeded,
  points and lines and shaders, no model files, no textures.

## Non-goals

- No downloaded or sculpted skull model.
- No anatomical accuracy. It has to read as a skull at a glance, not pass a
  medical exam.
- No new content system for projects. They already live in
  `client/src/content/work.js`.

## Anti-goals (it fails if…)

- The home screen gets slower or heavier for someone who never taps Build.
- It stutters on a mid-range phone.
- The projects are hard to tell apart from the neurons, or hard to tap.
- Back, Escape and links to `/c/build` stop working the way every other
  chapter does.

## Approaches considered

1. **Procedural, in the existing hub canvas (chosen).** Same idiom as
   `cosmos.js`: a pure, seeded module generates the skull, neurons and project
   paths as arrays; a component draws them with the site's point and line
   shaders. Lives in the same `<Canvas>`, so routing, back and Escape are
   unchanged and the transition can be continuous.
2. **Downloaded skull model + glass material.** Better anatomy for free, but
   ~1 MB, a licence to track, and not how the rest of the site is made.
   Rejected by Rahul: "build it just like our solar system and universe".
3. **A separate page with its own canvas.** Simpler to isolate, but the
   transition becomes a page cut, and back/escape would need re-plumbing.

## Design

### What you see

```
 ┌──────────────────────────────────────────┐
 │ ← All chapters                    BUILD  │
 │                                          │
 │            .  ·  ·  ·  ·  .              │
 │        ·   ╱‾‾‾‾‾‾‾‾‾‾‾‾‾╲   ·           │
 │      ·    ╱  ~*~ neurons ~*╲   ·         │
 │          │  ◉ Zamindara  ~* │            │
 │      ·   │ *~   ◉ Rights   ~│  ·         │
 │          │ ◎ ◎   ~*~    ~*  │            │
 │        ·  ╲      ▽       ╱  ·            │
 │            ╲__ ▔▔▔▔▔ __╱                 │
 │               ╹╹╹╹╹╹╹                    │
 └──────────────────────────────────────────┘
```

- **Skull:** a point cloud of a few thousand points sampled on the surface of
  a skull built from simple signed-distance shapes: cranium (stretched
  ellipsoid), brow ridge, two eye sockets and the nasal opening carved out,
  cheekbones, upper jaw, lower jaw, a row of teeth. Points are denser along
  the edges of sockets and jaw so the shape reads. Drawn additive and faint,
  so it is transparent by construction; a soft rim glow at the silhouette.
- **Neurons:** branching trees grown inside the cranium from a handful of
  seeds (random walks that fork and taper, kept inside the cranium
  ellipsoid). Drawn as thin dim lines. Pulses are bright points that run
  along the branches on a shader clock, many at once, different speeds.
- **Projects:** each is a bright node on its own slow closed path through the
  brain, with an HTML label (as the chapter labels already are). Larger and a
  different colour from neuron pulses. A faint trail behind each.
- **Motion:** the whole head turns slowly; drag turns it (the existing rig).
  Projects keep moving; hovering or focusing one slows it so it can be
  tapped.

### The transition

Tapping Build: the camera eases towards the figure's head as the hub (globe,
figure, branches) fades out; the skull fades and scales in around the
camera's target. Back reverses it. With reduced motion turned on, it
crossfades instead.

### Tapping a project

Routes to `/c/build/<project>` like any branch. The project comes to the
front and slows to a stop; the details panel opens with: title, one-line
blurb, what it is, the problem it solves, the stack, and repo/live links when
they exist. Back returns to the skull.

### Content

- Remove from the `build` chapter in `chapters.json`: the IIT Ropar `place`,
  `lede`, the bee paragraph and the "1 month" stat. The chapter panel is not
  shown on Build at all (the skull is the chapter).
- Projects come from `work.js` `featured` only: Zamindara and Rights today.
  Not DSA in Java or anything else in `also` (Rahul's call). Adding a project
  to `featured` adds it to the head.

### Performance

- The skull module is loaded only when Build opens (lazy import), the same
  way the games are.
- Phones get fewer skull points, fewer branches and fewer pulses.
- Generation runs once per mount; pulses move on the GPU.

### Testing

As with `cosmos.js`: the generator is pure and seeded, with a node test that
asserts no NaNs, every skull and neuron point is inside the bounds it should
be, every neuron point is inside the cranium, project paths stay inside the
cranium and are closed loops, and the same seed gives the same head.

## Left to the builder

Exact point counts, colours (use Build's accent `#3DDC97` for neurons and a
warm contrast for projects), speeds, the SDF proportions, and the camera
framing on phone vs desktop — tune by eye against the cosmos for consistency.
