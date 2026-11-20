/** Petite pastille rouge avec un nombre (nouveautés). */
export function Pastille({ nombre }: { nombre: number }) {
  if (nombre <= 0) return null;
  return (
    <span className="pastille-notif" aria-label={`${nombre} nouveauté${nombre > 1 ? 's' : ''}`}>
      {nombre > 9 ? '9+' : nombre}
    </span>
  );
}

/** Icône d'enveloppe cachetée (courrier, amis). */
export function IconeCourrier() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3 7l9 7 9-7" />
      <circle cx="12" cy="14" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
