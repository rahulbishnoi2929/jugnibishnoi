# scripts

One-off generators. Their output is committed, so you only run these if
you want to change the artwork.

## gen-earth.js

Builds `client/public/textures/earth.svg`, the globe texture, from real
coastline data.

```bash
curl -o land.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json
node scripts/gen-earth.js land.json
```

Takes two files now — land, and countries for the white borders:

```bash
node scripts/gen-earth.js land.json countries.json
```

Source: world-atlas `land-110m` and `countries-110m` (TopoJSON), derived
from **Natural Earth**, which is public domain. The TopoJSON is decoded
here rather than adding a topojson runtime dependency for something that
runs once.

Borders are baked into the texture rather than drawn as 3D lines — ~170
countries would be ~170 draw calls, and the texture resolves them fine at
this globe size.

**India is excluded from the white borders on purpose.** This dataset draws
India on the de-facto line; India's own boundary is drawn separately and
officially in wheat, from `client/src/hub/india.json`. Drawing both would
contradict itself. Neighbouring borders are also clipped where they fall
inside India's official territory — a point-in-polygon test against that
outline, which drops ~50 segments in the Kashmir region.

Rings crossing the antimeridian are split, otherwise they streak straight
across the map. Antarctica ends up open at the bottom as a result, which
never shows — the camera only ever sees the northern side.

## gen-india.js

Builds `client/src/hub/india.json`, the outline highlighted on the globe.

### Which boundary, and why it matters

India's boundaries are disputed and datasets disagree, so this is a
deliberate choice rather than a default.

| Source | Northernmost | Includes |
|---|---|---|
| Natural Earth (used first, wrong) | ~35.5°N | de-facto line only |
| **Datameet india-composite (current)** | **37.10°N** | **J&K in full** |

Natural Earth is what most web mapping defaults to, and it leaves out
Gilgit-Baltistan and Aksai Chin. That is not how India depicts itself, and
maps published in India are required to show the official boundary. This
uses Datameet's india-composite: India as India claims it, plus the island
territories.

The source is ~250k points across 80 rings and 10MB. Douglas-Peucker
simplification at 0.05° brings it to ~756 points across 9 rings, which is
all a line 1.35 units across can resolve. Rings under 0.25° are dropped as
sub-pixel.

Needs a raised stack for the recursion:

```bash
curl -o india-composite.geojson https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson
```

```bash
node --stack-size=8000 scripts/gen-india.js india-composite.geojson
```

## gen-soil.js / gen-scenes.js

The five chapter scenes in `client/public/scenes/` were generated the same
way. Those scripts live in the scratchpad rather than here; the SVGs are
the source of truth now and are edited directly if needed.
