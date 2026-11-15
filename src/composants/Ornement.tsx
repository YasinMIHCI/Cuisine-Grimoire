/** Filet décoratif (losange central et volutes) séparant les sections. */
export function Ornement() {
  return (
    <svg className="ornement" viewBox="0 0 200 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M4 8h70M126 8h70" />
        <path d="M74 8c6-7 12-7 16 0-4 7-10 7-16 0zM126 8c-6-7-12-7-16 0 4 7 10 7 16 0z" />
      </g>
      <path d="M100 2l6 6-6 6-6-6z" fill="currentColor" />
    </svg>
  );
}
