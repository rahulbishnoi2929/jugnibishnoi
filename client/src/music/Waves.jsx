// A band of music under everything, moving at the playlist's own tempo.
//
// Three layers at different speeds and widths, because one wave is a
// shape and three are a sea. Each path is drawn twice end to end across a
// 2400-wide viewBox and slid by exactly half of that, so the loop has no
// seam in it.
//
// Everything that makes a mood different — how fast it crosses, how tall
// it stands, what colour it is — is a CSS custom property set on the root
// element. Nothing here knows which playlist is playing, which is why
// adding a mood is two numbers rather than a component.
//
// SVG rather than canvas: no frame loop, sharp at any size, and the 3D
// scene is already asking enough of the machine.
const SHAPES = [
  'M0 70 C 150 20, 300 120, 450 70 C 600 20, 750 120, 900 70 C 1050 20, 1150 110, 1200 70 L 1200 200 L 0 200 Z',
  'M0 95 C 200 45, 320 140, 520 95 C 700 55, 820 140, 1000 95 C 1100 70, 1160 120, 1200 95 L 1200 200 L 0 200 Z',
  'M0 120 C 180 90, 340 160, 540 125 C 740 90, 900 160, 1080 125 C 1140 113, 1180 135, 1200 125 L 1200 200 L 0 200 Z',
]

export default function Waves() {
  return (
    <div className="waves" aria-hidden="true">
      <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
        {SHAPES.map((d, i) => (
          <g key={i}>
            <g className="swell">
              <path d={d} />
              <path d={d} transform="translate(1200 0)" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
