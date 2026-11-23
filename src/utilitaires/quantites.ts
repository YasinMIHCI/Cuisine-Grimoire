// Lecture des quantités et des listes d'ingrédients écrites à la main.
import type { Ingredient } from '../types';

/** Fractions écrites en un seul caractère. */
const FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅛': 1 / 8,
};
const CARACTERES_FRACTION = Object.keys(FRACTIONS).join('');

/**
 * Motif d'une quantité en début de texte : « 2 », « 1,5 », « 0.25 », « 1/2 »,
 * « 1 1/2 », « ½ », « 1½ », « 1 ½ ».
 */
const MOTIF_QUANTITE = new RegExp(
  `^(?:(\\d+)\\s*([${CARACTERES_FRACTION}])|(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)|(\\d+)\\s*/\\s*(\\d+)|([${CARACTERES_FRACTION}])|(\\d+(?:[.,]\\d+)?))`,
);

/** Valeur d'une quantité au début d'un texte, et longueur du passage lu. */
function lireDebut(texte: string): { valeur: number; longueur: number } | null {
  const m = MOTIF_QUANTITE.exec(texte);
  if (!m) return null;
  let valeur: number;
  if (m[1] !== undefined) valeur = Number(m[1]) + FRACTIONS[m[2]];
  else if (m[3] !== undefined) valeur = Number(m[3]) + Number(m[4]) / Number(m[5]);
  else if (m[6] !== undefined) valeur = Number(m[6]) / Number(m[7]);
  else if (m[8] !== undefined) valeur = FRACTIONS[m[8]];
  else valeur = Number(m[9].replace(',', '.'));
  if (!Number.isFinite(valeur)) return null;
  return { valeur, longueur: m[0].length };
}

/**
 * Lit une quantité saisie : « 1/2 » → 0,5, « 1 1/2 » → 1,5, « ½ » → 0,5,
 * « 2,5 » → 2,5. Renvoie null si le texte n'est pas une quantité complète.
 */
export function lireQuantite(texte: string): number | null {
  const propre = texte.trim();
  if (!propre) return null;
  const lu = lireDebut(propre);
  if (!lu || lu.longueur !== propre.length) return null;
  return lu.valeur;
}

/** Unités reconnues en tête d'une ligne d'ingrédient (la plus longue d'abord). */
const UNITES = [
  'cuillères à soupe', 'cuillère à soupe', 'cuillères à café', 'cuillère à café',
  'c. à soupe', 'c. à café', 'c. à s.', 'c. à c.', 'c.à.s.', 'c.à.c.', 'càs', 'càc', 'cs', 'cc',
  'kg', 'g', 'mg', 'l', 'dl', 'cl', 'ml',
  'pincées', 'pincée', 'sachets', 'sachet', 'tranches', 'tranche', 'gousses', 'gousse',
  'branches', 'branche', 'brins', 'brin', 'feuilles', 'feuille', 'bottes', 'botte',
  'boîtes', 'boîte', 'pots', 'pot', 'verres', 'verre', 'tasses', 'tasse', 'poignées', 'poignée',
  'noix', 'filets', 'filet', 'zestes', 'zeste', 'morceaux', 'morceau',
];

const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MOTIF_UNITE = new RegExp(`^(${UNITES.map(echapper).join('|')})(?![\\p{L}])\\s*(?:(?:de|d’|d')\\s*)?`, 'iu');

/**
 * Lit une ligne d'ingrédient écrite librement : « 200 g de farine »,
 * « 1/2 c. à café de sel », « 3 œufs », « sel, poivre ».
 */
export function lireLigneIngredient(ligne: string): Ingredient | null {
  // Puces et tirets de début de ligne
  let reste = ligne.replace(/^\s*(?:[-*•◆·–—]|\d+[.)](?=\s))\s*/, '').trim();
  if (!reste) return null;
  let quantite: number | null = null;
  let unite = '';
  const lu = lireDebut(reste);
  if (lu) {
    quantite = lu.valeur;
    reste = reste.slice(lu.longueur).trim();
    const u = MOTIF_UNITE.exec(reste);
    if (u) {
      unite = u[1];
      reste = reste.slice(u[0].length).trim();
    } else {
      reste = reste.replace(/^(?:de|d’|d')\s+/i, '');
    }
  }
  if (!reste) return null;
  return { quantite, unite, nom: reste };
}

/** Lit une liste d'ingrédients collée (une ligne par ingrédient). */
export function lireListeIngredients(texte: string): Ingredient[] {
  return texte
    .split(/\r?\n/)
    .map(lireLigneIngredient)
    .filter((i): i is Ingredient => i !== null);
}
