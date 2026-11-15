import type { NomSymbole } from '../types';

// Tracés SVG (grille 24×24) des symboles du grimoire, dessinés au trait.
const TRACES: Record<NomSymbole, string> = {
  chaudron:
    'M4 10h16M5 10c-1 5 2 9 7 9s8-4 7-9M8 19l-1 2M16 19l1 2M10 7c-1-1 1-2 0-3.5M14 7c-1-1 1-2 0-3.5',
  feuille: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l9-9',
  etoile: 'M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.3l6-.7z',
  coupe: 'M7 4h10c0 5-2 8-5 8s-5-3-5-8zM12 12v6M8 20h8',
  epi: 'M12 21V8M12 8c-2-1-3-3-2-5 2 1 3 3 2 5zM12 12c-3 0-4-2-4-4 3 0 4 2 4 4zM12 12c3 0 4-2 4-4-3 0-4 2-4 4zM12 16c-3 0-4-2-4-4 3 0 4 2 4 4zM12 16c3 0 4-2 4-4-3 0-4 2-4 4z',
  flamme: 'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z',
  poisson: 'M3 12c3-4 7-5 11-4 2 .5 4 2 5 4-1 2-3 3.5-5 4-4 1-8 0-11-4zM19 12l2-3v6zM8 11h.01',
  lune: 'M18 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 8.5 10.5zM17 4l.7 1.8L19.5 6.5l-1.8.7L17 9l-.7-1.8L14.5 6.5l1.8-.7z',
};

interface Props {
  nom: NomSymbole;
  taille?: number;
}

/** Petit pictogramme doré/encre, utilisé pour les vignettes et les couvertures. */
export function Symbole({ nom, taille = 24 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACES[nom]} />
    </svg>
  );
}
