# Photos and clips

Drop a file in the folder for its chapter. That is the whole process —
nothing to register, no JSON to edit, no server.

```
src/photos/
  soil/      farming, the village, the fields
  grit/      basketball, volleyball, athletics, shooting ball
  campus/    BFCET, hostel, whatever you dig up
  build/     IIT Ropar, screens, work in progress
  signal/    the three hackathons
```

## Naming

**The filename becomes the caption and the alt text.** So name them like
sentences, not like a camera does.

- `wheat-harvest-at-4am.jpg` → "Wheat harvest at 4am"
- `01_first-hackathon-crowd.jpg` → "First hackathon crowd"

A leading number sets the order (`01_`, `02_`). Without one they sort by
name. Underscores and dashes become spaces.

`IMG_20240817_093122.jpg` will technically work and will read as
"Img 20240817 093122", which is not alt text. Rename it.

## Formats

`.jpg .jpeg .png .webp .avif` for stills, `.mp4 .webm` for clips.

Clips get a normal player — no autoplay, muted by default. Keep them
short; a 40MB video will wreck the page it sits on.

## Size

Anything up to about 2000px wide is fine, Vite hashes and caches them.
Much bigger than that and you are making visitors download your camera's
full resolution for no reason.
