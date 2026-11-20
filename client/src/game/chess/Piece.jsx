// The pieces, drawn here rather than borrowed from a font.
//
// They used to be the unicode chess glyphs, which are whatever the visitor's
// fonts make of them: thin outlines on one machine, emoji on another, and
// the two sides told apart only by a fill you could barely see. These are
// solid silhouettes on a 100-unit square, one set for both sides, coloured
// by CSS. Paths are filled and outlined; `.d` is a detail line and `.e` a
// detail dot, drawn in the outline's opposite so they read on both sides.

const BASE = (x, w) => <rect x={x} y="78" width={w} height="10" rx="4" />

const SHAPES = {
  p: (
    <>
      <path d="M33 78C35 66 42 60 43 52H57C58 60 65 66 67 78Z" />
      {BASE(28, 44)}
      <rect x="37" y="47" width="26" height="6" rx="3" />
      <circle cx="50" cy="35" r="13" />
    </>
  ),
  r: (
    <>
      <path d="M33 78L36 46H64L67 78Z" />
      {BASE(24, 52)}
      <path d="M29 46V24H38V31H45V24H55V31H62V24H71V46Z" />
      <path className="d" d="M37 53H63" />
    </>
  ),
  n: (
    <>
      <path d="M33 78C33 66 41 60 46 53C39 56 31 61 25 59C19 57 17 51 20 46C25 37 31 30 37 26L40 15L48 23C64 23 76 38 74 58L72 78Z" />
      {BASE(22, 56)}
      <path className="d" d="M57 29C65 37 67 49 65 62" />
      <circle className="e" cx="40" cy="34" r="2.8" />
      <circle className="e" cx="24" cy="50" r="1.6" />
    </>
  ),
  b: (
    <>
      <path d="M35 78C38 70 43 64 44 58H56C57 64 62 70 65 78Z" />
      {BASE(26, 48)}
      <rect x="37" y="53" width="26" height="6" rx="3" />
      <path d="M50 17C63 27 67 41 59 53H41C33 41 37 27 50 17Z" />
      <circle cx="50" cy="12" r="5" />
      <path className="d" d="M55 29L46 41" />
    </>
  ),
  q: (
    <>
      <path d="M34 78C37 72 38 68 38 66H62C62 68 63 72 66 78Z" />
      {BASE(24, 52)}
      <rect x="32" y="60" width="36" height="6" rx="3" />
      <path d="M33 60L24 30L37 44L39 22L47 41L50 18L53 41L61 22L63 44L76 30L67 60Z" />
      <circle cx="24" cy="28" r="4.5" />
      <circle cx="39" cy="20" r="4.5" />
      <circle cx="50" cy="15" r="4.5" />
      <circle cx="61" cy="20" r="4.5" />
      <circle cx="76" cy="28" r="4.5" />
    </>
  ),
  k: (
    <>
      <path d="M35 78C37 72 38 66 38 63H62C62 66 63 72 65 78Z" />
      {BASE(24, 52)}
      <rect x="33" y="57" width="34" height="6" rx="3" />
      <path d="M33 57C24 47 28 33 40 35C44 30 47 29 50 33C53 29 56 30 60 35C72 33 76 47 67 57Z" />
      <path d="M47 9H53V15H59V21H53V31H47V21H41V15H47Z" />
      <path className="d" d="M39 47H61" />
    </>
  ),
}

export default function Piece({ type, color, className = '', style }) {
  return (
    <svg
      viewBox="6 5 88 88"
      className={'chess-piece is-' + color + (className ? ' ' + className : '')}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[type]}
    </svg>
  )
}
