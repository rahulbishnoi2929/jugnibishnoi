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

Source: world-atlas `land-110m` (TopoJSON), derived from **Natural Earth**,
which is public domain. The TopoJSON is decoded here rather than adding a
topojson runtime dependency for something that runs once.

Rings crossing the antimeridian are split, otherwise they streak straight
across the map. Antarctica ends up open at the bottom as a result, which
never shows — the camera only ever sees the northern side.

## gen-soil.js / gen-scenes.js

The five chapter scenes in `client/public/scenes/` were generated the same
way. Those scripts live in the scratchpad rather than here; the SVGs are
the source of truth now and are edited directly if needed.
