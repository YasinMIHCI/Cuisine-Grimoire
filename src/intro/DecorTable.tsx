// Décor de la table autour du grimoire, vu du dessus : un bureau de sorcier-cuisinier.
// Les objets ne sont pas semés au hasard : ils forment quatre ensembles rangés
// aux coins de la table (livres et bougies, fioles, nécessaire d'écriture, coin
// cuisine). Tout est dessiné en SVG ; chaque objet tient dans une boîte de 100 × 100.
import type { CSSProperties, ReactNode } from 'react';

const TRAIT = '#2a170c';

/** Bougie allumée sur sa coupelle, avec un halo de lumière. */
const Bougie = (
  <>
    <circle className="intro__halo" cx="50" cy="50" r="80" fill="url(#halo-bougie)" />
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

/** Place un objet (boîte 100 × 100) dans un ensemble : position, échelle, rotation. */
function Pose({ x, y, e = 1, r = 0, children }: { x: number; y: number; e?: number; r?: number; children: ReactNode }) {
  return <g transform={`translate(${x} ${y}) scale(${e}) rotate(${r} 50 50)`}>{children}</g>;
}

/** Livre fermé vu du dessus : tranche des pages, couverture, dos et filet doré. */
function LivreFerme({ x, y, l, h, r, cuir, dos }: { x: number; y: number; l: number; h: number; r: number; cuir: string; dos: string }) {
  return (
    <g transform={`rotate(${r} ${x + l / 2} ${y + h / 2})`}>
      <rect x={x + 5} y={y + 5} width={l} height={h} rx="3" fill="#e2cf9f" stroke="#8a7445" />
      <rect x={x} y={y} width={l} height={h} rx="4" fill={cuir} stroke={TRAIT} strokeWidth="2" />
      <rect x={x} y={y} width={l * 0.12} height={h} rx="3" fill={dos} />
      <rect x={x + l * 0.2} y={y + 8} width={l * 0.7} height={h - 16} rx="2" fill="none" stroke="#c9a23f" strokeWidth="1.5" />
    </g>
  );
}

/** Flacon debout vu du dessus : verre, liquide, goulot et bouchon de liège. */
function Flacon({ cx, cy, r, verre, liquide }: { cx: number; cy: number; r: number; verre: string; liquide: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={verre} stroke={TRAIT} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill={liquide} opacity="0.9" />
      <circle cx={cx} cy={cy} r={r * 0.42} fill={verre} stroke={TRAIT} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r * 0.28} fill="#b08a5a" stroke="#6b4f2c" />
      <path
        d={`M${cx - r * 0.62} ${cy - r * 0.2}a${r * 0.66} ${r * 0.66} 0 0 1 ${r * 0.5} -${r * 0.45}`}
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>
  );
}

/** Petit cristal taillé. */
function Cristal({ x, y, r, couleur }: { x: number; y: number; r: number; couleur: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0-14L9-5 6 13-6 13-9-5z" fill={couleur} stroke={TRAIT} strokeWidth="1.5" />
      <path d="M0-14v27M-9-5L0 1 9-5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.6" />
    </g>
  );
}

// --- Les quatre ensembles (boîte de 200 × 200) -------------------------------

/** Pile de livres bien alignée, une bougie posée dessus et une autre à côté. */
const PileDeLivres = (
  <>
    <LivreFerme x={14} y={34} l={128} h={158} r={-5} cuir="#2f4a3a" dos="#1f3327" />
    <LivreFerme x={26} y={46} l={112} h={138} r={3} cuir="#6b2418" dos="#4a160d" />
    <LivreFerme x={38} y={60} l={94} h={116} r={-2} cuir="#26324f" dos="#182036" />
    <circle cx="90" cy="122" r="13" fill="none" stroke="#c9a23f" strokeWidth="1.5" />
    <path d="M90 113l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7-5.9-3.7-5.9 3.7 1.7-6.7-5.3-4.4 6.9-.5z" fill="#c9a23f" />
    <Pose x={96} y={-4} e={0.72}>{Bougie}</Pose>
    <Pose x={140} y={104} e={0.56}>{Bougie}</Pose>
    <Pose x={150} y={150} e={0.44}>{Bougie}</Pose>
  </>
);

/** Fioles serrées les unes contre les autres, boule de cristal, cristaux et rouleaux. */
const Alchimie = (
  <>
    <Flacon cx={52} cy={48} r={30} verre="#2f6b4f" liquide="#58c08a" />
    <Flacon cx={104} cy={36} r={20} verre="#6b2a2a" liquide="#d05a4a" />
    <Flacon cx={96} cy={84} r={23} verre="#3d3470" liquide="#8f7fe0" />
    <Flacon cx={46} cy={98} r={16} verre="#6a5a1e" liquide="#e0c040" />
    {/* Boule de cristal sur son socle de laiton */}
    <circle cx="156" cy="62" r="34" fill="#8a6a2a" stroke="#4d3812" strokeWidth="2" />
    <circle cx="156" cy="62" r="27" fill="url(#boule-cristal)" stroke="#231a4a" strokeWidth="1.5" />
    <path d="M140 50a20 20 0 0 1 16-10" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
    <Cristal x={136} y={116} r={-18} couleur="#9fe0e8" />
    <Cristal x={162} y={120} r={14} couleur="#c9a0f0" />
    {/* Deux rouleaux rangés côte à côte */}
    <Pose x={20} y={112} e={1.5} r={-4}>{Parchemin}</Pose>
    <Pose x={30} y={136} e={1.4} r={-4}>{Parchemin}</Pose>
  </>
);

/** Nécessaire d'écriture : lettre commencée, enveloppe cachetée, plume dans l'encrier, clé. */
const Ecriture = (
  <>
    <g transform="rotate(-7 90 100)">
      <rect x="30" y="14" width="124" height="172" rx="2" fill="#ead9b0" stroke="#a8905a" strokeWidth="1.5" />
      <g fill="none" stroke="#4a3520" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M44 ${36 + i * 15}q8-5 16 0t16 0 16 0 16 0 ${i % 3 === 2 ? 8 : 16} 0${i % 3 === 2 ? '' : ' 14 0'}`} />
        ))}
      </g>
    </g>
    <g transform="rotate(9 140 150)">
      <rect x="98" y="122" width="88" height="58" rx="2" fill="#f1e5c4" stroke="#a8905a" strokeWidth="1.5" />
      <path d="M98 122l44 32 44-32" fill="none" stroke="#a8905a" strokeWidth="1.5" />
      <circle cx="142" cy="154" r="11" fill="#a3241a" stroke="#5a120c" strokeWidth="1.5" />
      <circle cx="142" cy="154" r="5.5" fill="none" stroke="#d0564a" strokeWidth="1.5" />
    </g>
    <Pose x={36} y={4} e={1.45}>{PlumeEncrier}</Pose>
    <Pose x={4} y={150} e={0.5} r={-20}>{Cle}</Pose>
  </>
);

/** Coin cuisine : carnet et lunettes rondes, bol d'épices, cuillère, romarin, badiane. */
const Cuisine = (
  <>
    <g transform="rotate(5 70 130)">
      <rect x="14" y="74" width="106" height="120" rx="4" fill="#2b2530" stroke={TRAIT} strokeWidth="2" />
      <rect x="24" y="84" width="86" height="100" rx="2" fill="none" stroke="#c9a23f" strokeWidth="1.5" />
      {/* Lunettes rondes posées sur le carnet */}
      <g fill="rgba(200, 220, 255, 0.16)" stroke="#0c0a0e" strokeWidth="5" strokeLinecap="round">
        <circle cx="46" cy="132" r="19" />
        <circle cx="92" cy="132" r="19" />
        <path d="M65 130q4-5 8 0M27 130L12 108M111 130l15-22" fill="none" />
      </g>
    </g>
    <Pose x={104} y={2} e={0.92}>{BolEpices}</Pose>
    <Pose x={118} y={62} e={0.95} r={-38}>{Cuillere}</Pose>
    <Pose x={118} y={118} e={0.8} r={12}>{Romarin}</Pose>
    <Pose x={62} y={20} e={0.32} r={10}>{Badiane}</Pose>
    <Pose x={80} y={48} e={0.26} r={-25}>{Badiane}</Pose>
  </>
);

interface Ensemble {
  nom: string;
  dessin: ReactNode;
  /** Position du centre, en % de l'écran. */
  x: number;
  y: number;
  rotation: number;
}

// Un ensemble par coin : la bande centrale reste libre pour le livre, qui s'y
// ouvre en double page. Les rotations restent faibles : tout est « rangé ».
const ENSEMBLES: Ensemble[] = [
  { nom: 'livres', dessin: PileDeLivres, x: 25, y: 15, rotation: -3 },
  { nom: 'alchimie', dessin: Alchimie, x: 76, y: 14, rotation: 2 },
  { nom: 'ecriture', dessin: Ecriture, x: 25, y: 85, rotation: 3 },
  { nom: 'cuisine', dessin: Cuisine, x: 73, y: 85, rotation: -2 },
];

/** Le décor de la table. Les ensembles sursautent à l'impact (voir Intro.tsx). */
export function DecorTable() {
  return (
    <>
      {/* Dégradés partagés par les dessins */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id="halo-bougie">
            <stop offset="0.2" stopColor="#ffd98a" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="boule-cristal" cx="0.4" cy="0.35">
            <stop offset="0" stopColor="#dfe6ff" />
            <stop offset="0.5" stopColor="#6a5fc0" />
            <stop offset="1" stopColor="#2a2060" />
          </radialGradient>
        </defs>
      </svg>
      {ENSEMBLES.map((ensemble) => (
        <div
          key={ensemble.nom}
          className="intro__objet"
          style={
            {
              left: `${ensemble.x}%`,
              top: `${ensemble.y}%`,
              rotate: `${ensemble.rotation}deg`,
            } as CSSProperties
          }
        >
          <svg viewBox="0 0 200 200" aria-hidden="true">
            {ensemble.dessin}
          </svg>
        </div>
      ))}
    </>
  );
}
