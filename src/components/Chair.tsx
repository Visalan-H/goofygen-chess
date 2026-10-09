// A chair seen from a three-quarter angle: the seat is drawn as a box, the back sits on its far edge.
export function Chair() {
  return (
    <svg className="home-chair" viewBox="0 0 120 150" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform="translate(120 0) scale(-1 1)">
      {/* back posts, rail and spindles */}
      <path d="M44 78 L42 10 L94 10 L96 78" strokeWidth="6" />
      <path d="M62 12 L62 76" strokeWidth="4" />
      <path d="M78 12 L78 76" strokeWidth="4" />
      {/* far legs */}
      <path d="M44 90 L44 130" />
      <path d="M96 90 L96 130" />
      {/* seat top, then the two visible faces */}
      <path d="M22 88 L74 88 L96 76 L44 76 Z" fill="var(--color-background)" />
      <path d="M22 88 L74 88 L74 97 L22 97 Z" fill="currentColor" />
      <path d="M74 88 L96 76 L96 85 L74 97 Z" fill="currentColor" />
      {/* near legs and stretchers */}
      <path d="M24 98 L24 142" />
      <path d="M72 98 L72 142" />
      <path d="M24 120 L72 120" />
      <path d="M72 120 L96 108" />
      </g>
    </svg>
  );
}
