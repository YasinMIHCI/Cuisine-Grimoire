// Objets posés sur la table autour du grimoire, vus du dessus.
// Tout est dessiné en SVG (boîte de 100 × 100 par objet).
import type { CSSProperties, ReactNode } from 'react';

const TRAIT = '#2a170c';

/** Bougie allumée sur sa coupelle, avec un halo de lumière. */
const Bougie = (
  <>
    <circle className="intro__halo" cx="50" cy="50" r="49" fill="url(#halo-bougie)" />
    <circle cx="50" cy="50" r="27" fill="#8a6a2a" stroke="#4d3812" strokeWidth="2" />
    <circle cx="50" cy="50" r="21" fill="#a8843a" />
    <path d="M36 47c0-10 8-16 16-15s14 8 12 18-10 15-18 13-10-8-10-16z" fill="#f1e5c4" stroke="#c9b88d" />
    <circle cx="50" cy="49" r="7" fill="#ffcf5c" />
    <circle cx="50" cy="49" r="3.5" fill="#fff8dc" />
  </>
);

/** Bol en bois rempli d'épices. */
const BolEpices = (
  <>
    <circle cx="50" cy="50" r="40" fill="#6b4423" stroke={TRAIT} strokeWidth="2" />
    <circle cx="50" cy="50" r="32" fill="#c5621c" stroke="#4a2c14" strokeWidth="1.5" />
    <path d="M30 44c8-9 26-11 38-2" fill="none" stroke="#e08a3a" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
    <g fill="#8f3f0f">
      <circle cx="42" cy="58" r="2" /><circle cx="58" cy="62" r="2.5" /><circle cx="63" cy="50" r="1.8" />
      <circle cx="48" cy="68" r="1.6" /><circle cx="36" cy="50" r="1.5" />
    </g>
  </>
);

/** Brin de romarin : une tige et ses aiguilles. */
const Romarin = (
  <g fill="none" strokeLinecap="round">
    <path d="M10 88C30 70 60 40 90 12" stroke="#4d5a2a" strokeWidth="2.5" />
    {Array.from({ length: 11 }, (_, i) => {
      const x = 16 + i * 6.6;
      const y = 82 - i * 6.3;
      return (
        <path
          key={i}
          d={`M${x} ${y}l-9 -5M${x} ${y}l4 9`}
          stroke={i % 2 ? '#6f8f45' : '#5d7a3a'}
          strokeWidth="2.6"
        />
      );
    })}
  </g>
);

/** Encrier et plume d'oie. */
const PlumeEncrier = (
  <>
    <circle cx="24" cy="76" r="15" fill="#23202b" stroke={TRAIT} strokeWidth="2" />
    <circle cx="24" cy="76" r="8" fill="#0b0a10" />
    <path d="M17 70c3-4 8-5 12-3" fill="none" stroke="#6d6a80" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 70C48 60 78 30 92 8c-2 20-18 50-44 62-6 3-12 4-18 0z" fill="#efe6d2" stroke="#b9ab8c" strokeWidth="1.5" />
    <path d="M26 74C48 56 74 30 92 8" fill="none" stroke="#9c8f72" strokeWidth="1.5" />
    <path d="M52 52l10 3M62 42l10 2M72 31l8 1" fill="none" stroke="#b9ab8c" strokeWidth="1.2" />
  </>
);

/** Cuillère en bois. */
const Cuillere = (
  <>
    <rect x="46" y="38" width="8" height="58" rx="4" fill="#9a6a3a" stroke={TRAIT} strokeWidth="1.5" />
    <ellipse cx="50" cy="24" rx="15" ry="20" fill="#a9763f" stroke={TRAIT} strokeWidth="1.5" />
    <ellipse cx="50" cy="25" rx="9" ry="14" fill="#7d5229" />
  </>
);

/** Fiole de potion couchée, fermée par un bouchon de liège. */
const Fiole = (
  <>
    <circle cx="42" cy="56" r="28" fill="#2f6b4f" stroke={TRAIT} strokeWidth="2" />
    <path d="M17 60a26 26 0 0 0 50 2c-12 5-36 5-50-2z" fill="#58c08a" opacity="0.85" />
    <path d="M26 42c4-7 12-11 20-10" fill="none" stroke="#bfe8d2" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M58 32l12-12 10 10-12 12z" fill="#3a7d5d" stroke={TRAIT} strokeWidth="2" />
    <path d="M71 17l8-8 12 12-8 8z" fill="#b08a5a" stroke={TRAIT} strokeWidth="1.5" />
  </>
);

/** Parchemin roulé, noué d'un ruban rouge. */
const Parchemin = (
  <>
    <rect x="8" y="36" width="84" height="28" rx="12" fill="#e2cf9f" stroke="#8a7445" strokeWidth="2" />
    <ellipse cx="14" cy="50" rx="6" ry="14" fill="#cdb37c" stroke="#8a7445" strokeWidth="1.5" />
    <ellipse cx="86" cy="50" rx="6" ry="14" fill="#cdb37c" stroke="#8a7445" strokeWidth="1.5" />
    <path d="M86 44a3 6 0 1 0 .1 0" fill="none" stroke="#8a7445" strokeWidth="1.2" />
    <rect x="44" y="35" width="10" height="30" fill="#8c2a1c" stroke="#5a170e" strokeWidth="1" />
    <path d="M49 65l-7 16 7-5 7 5z" fill="#8c2a1c" stroke="#5a170e" strokeWidth="1" />
  </>
);

/** Vieille clé dorée. */
const Cle = (
  <g fill="none" stroke="#c9a23f" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="26" cy="50" r="15" />
    <path d="M41 50h48M74 50v14M86 50v11" />
  </g>
);

/** Quelques pièces d'or. */
const Pieces = (
  <g stroke="#7a5a14" strokeWidth="2">
    {[
      [36, 62],
      [62, 58],
      [50, 36],
    ].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r="19" fill="#d9b34a" />
        <circle cx={x} cy={y} r="12" fill="none" stroke="#a8842a" strokeWidth="1.5" />
      </g>
    ))}
  </g>
);

/** Étoile de badiane (anis étoilé). */
const Badiane = (
  <g>
    {Array.from({ length: 8 }, (_, i) => (
      <g key={i} transform={`rotate(${i * 45} 50 50)`}>
        <path d="M50 50c-9-14-8-30 0-42 8 12 9 28 0 42z" fill="#6e3d1e" stroke={TRAIT} strokeWidth="1.5" />
        <ellipse cx="50" cy="26" rx="3" ry="6" fill="#c98a4a" />
      </g>
    ))}
    <circle cx="50" cy="50" r="6" fill="#4a2812" />
  </g>
);

/** Gousse d'ail. */
const Ail = (
  <>
    <path d="M50 14c6 12 30 22 30 46 0 18-14 28-30 28S20 78 20 60c0-24 24-34 30-46z" fill="#efe7d6" stroke="#a89b80" strokeWidth="2" />
    <path d="M50 16c-4 22-8 44-4 70M50 16c4 22 8 44 4 70M36 40c-6 14-6 30 0 42M64 40c6 14 6 30 0 42" fill="none" stroke="#c9bda2" strokeWidth="1.5" />
    <path d="M50 14c-1-4 1-8 4-10" fill="none" stroke="#a89b80" strokeWidth="3" strokeLinecap="round" />
  </>
);

interface Objet {
  nom: string;
  dessin: ReactNode;
  /** Position du centre, en % de l'écran. */
  x: number;
  y: number;
  /** Taille en % du petit côté de l'écran. */
  taille: number;
  rotation: number;
}

// Les objets sont répartis en haut et en bas : la bande centrale reste libre
// pour le livre, qui s'y ouvre en double page.
const OBJETS: Objet[] = [
  { nom: 'bougie', dessin: Bougie, x: 17, y: 13, taille: 30, rotation: 0 },
  { nom: 'cle', dessin: Cle, x: 46, y: 8, taille: 17, rotation: -24 },
  { nom: 'bol', dessin: BolEpices, x: 80, y: 13, taille: 27, rotation: 0 },
  { nom: 'badiane-1', dessin: Badiane, x: 60, y: 22, taille: 9, rotation: 12 },
  { nom: 'romarin', dessin: Romarin, x: 22, y: 28, taille: 26, rotation: 28 },
  { nom: 'pieces', dessin: Pieces, x: 90, y: 29, taille: 13, rotation: 0 },
  { nom: 'parchemin', dessin: Parchemin, x: 20, y: 75, taille: 30, rotation: -16 },
  { nom: 'ail', dessin: Ail, x: 53, y: 73, taille: 13, rotation: 30 },
  { nom: 'plume', dessin: PlumeEncrier, x: 80, y: 78, taille: 34, rotation: 8 },
  { nom: 'badiane-2', dessin: Badiane, x: 8, y: 90, taille: 8, rotation: -30 },
  { nom: 'cuillere', dessin: Cuillere, x: 40, y: 90, taille: 30, rotation: 68 },
  { nom: 'fiole', dessin: Fiole, x: 87, y: 93, taille: 20, rotation: 20 },
];

/** Tous les objets de la table. Ils sursautent à l'impact (voir Intro.tsx). */
export function DecorTable() {
  return (
    <>
      {OBJETS.map((objet) => (
        <div
          key={objet.nom}
          className="intro__objet"
          style={
            {
              left: `${objet.x}%`,
              top: `${objet.y}%`,
              width: `${objet.taille}vmin`,
              rotate: `${objet.rotation}deg`,
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            {objet.nom === 'bougie' && (
              <defs>
                <radialGradient id="halo-bougie">
                  <stop offset="0.3" stopColor="#ffd98a" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
                </radialGradient>
              </defs>
            )}
            {objet.dessin}
          </svg>
        </div>
      ))}
    </>
  );
}
