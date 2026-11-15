// Page « illisible » de l'intro : des lignes de runes inventées, dessinées en SVG.

/** Tracés de base des runes (boîte de 10 × 14). */
const RUNES = [
  'M2 1v12M2 3l6 3-6 3',
  'M2 1v12M8 1v12M2 5l6 4',
  'M5 1v12M1 4l8 6',
  'M2 1v12M2 1l6 4-6 4',
  'M1 13L5 1l4 12',
  'M5 1v12M5 4l4-3M5 8l4-3',
  'M2 1v12M2 1l5 3v9',
  'M1 1l8 12M9 1L1 13',
  'M5 1v12M1 5l4 3 4-3',
  'M2 1l6 6-6 6',
];

/** Petit générateur pseudo-aléatoire : la page est identique à chaque lancement. */
function generateur(graine: number) {
  let etat = graine;
  return () => {
    etat = (etat * 1664525 + 1013904223) % 4294967296;
    return etat / 4294967296;
  };
}

export function PageRunes() {
  const hasard = generateur(7);
  const glyphes: { x: number; y: number; trace: string }[] = [];
  for (let ligne = 0; ligne < 12; ligne++) {
    for (let colonne = 0; colonne < 13; colonne++) {
      // Quelques blancs pour former des « mots », et une fin de ligne irrégulière
      if (hasard() < 0.16 || (colonne > 9 && hasard() < 0.4)) continue;
      glyphes.push({
        x: 16 + colonne * 13,
        y: 62 + ligne * 17.5,
        trace: RUNES[Math.floor(hasard() * RUNES.length)],
      });
    }
  }

  return (
    <svg className="intro__runes" viewBox="0 0 200 280" aria-hidden="true">
      {/* Sceau en tête de page */}
      <g fill="none" stroke="#8c2a1c" strokeWidth="1.3">
        <circle cx="100" cy="30" r="15" />
        <circle cx="100" cy="30" r="11" />
        <path d="M92 22h16v16H92zM100 18.7l11.3 11.3L100 41.3 88.7 30z" />
      </g>
      <g fill="none" stroke="#2e1d10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {glyphes.map((g, i) => (
          <path key={i} d={g.trace} transform={`translate(${g.x} ${g.y}) scale(0.95)`} />
        ))}
      </g>
    </svg>
  );
}
