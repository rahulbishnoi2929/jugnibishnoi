# The figure

Drop a `.glb` of yourself in this folder and say so. Nothing here is loaded
until the code points at it, so an unused file costs nothing.

The silhouette in `client/src/hub/Figure.jsx` is a placeholder built from
primitives — a sphere, some capsules. It is deliberately not a likeness: a
bad likeness reads worse than an obvious stand-in.

## What the file has to be

- **`.glb`** — binary glTF. Not `.fbx`, `.obj` or `.blend`.
- **Under about 1.5 MB.** The hub already ships 969 KB of JavaScript and
  this loads on top of it. A raw photogrammetry scan is usually 10-20 MB;
  Draco or meshopt compression takes that under 1 MB, and that is a step
  to run here rather than something you need to do first.
- **Y up, feet at the origin, facing +Z.** If it is not, that is a line of
  code, not a problem — send it however it comes out.
- **Any height.** It gets normalised to the scene.

## Where the size actually matters

He is drawn about **104 pixels tall on a phone** and 170 on a desktop. That
is the number to keep in mind: at that size a detailed scan of a person
looks *worse* than a clean stylised model, because scans come out lumpy
around the hair, hands and feet and that noise reads as a blob. Detail is
not what this needs.

## Two things to check once it is in

- **`HEAD_Y` in `layout.js`** is where the branches attach. It has to be
  re-measured from the real model, or they will hang off his chin.
- **`figureFor`** scales him down on a phone so the branch ring clears his
  head. A model with different proportions needs that number checked
  against the ring again.
