// Mise en forme de textes : dates relatives, recette en texte brut.
import type { Recette } from '../types';
import { formaterDuree, formaterQuantite } from './format';

/** « à l'instant », « il y a 5 min », « hier », « le 12 nov. »… */
export function ilYa(iso: string): string {
  const secondes = (Date.now() - Date.parse(iso)) / 1000;
  if (secondes < 60) return 'à l’instant';
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  if (secondes < 172800) return 'hier';
  return `le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

/** Une recette en texte brut, pour la partager hors de l'appli (SMS, messagerie…). */
export function recetteEnTexte(recette: Recette, portions = recette.portions): string {
  const facteur = portions / recette.portions;
  const lignes = [
    recette.titre.toUpperCase(),
    `Préparation : ${formaterDuree(recette.tempsPreparation)} · Cuisson : ${formaterDuree(recette.tempsCuisson)} · ${portions} portion${portions > 1 ? 's' : ''}`,
    '',
    'INGRÉDIENTS',
    ...recette.ingredients.map(
      (i) =>
        `- ${i.quantite !== null ? `${formaterQuantite(ajusterQuantite(i.quantite, facteur, i.unite))}${i.unite ? ` ${i.unite}` : ''} ` : ''}${i.nom}`,
    ),
    '',
    'PRÉPARATION',
    ...recette.etapes.map((e, n) => `${n + 1}. ${e.texte}`),
  ];
  if (recette.notes) lignes.push('', `Notes : ${recette.notes}`);
  return lignes.join('\n');
}

/** Unités qui se comptent par demi au plus fin (cuillères, pincées, sachets…). */
const UNITES_PAR_DEMI = /^(c\.|cuill|pinc|sachet|tranche|gousse|branche|brin|feuille|botte|bouquet|bo[iî]te|pot|verre|tasse|poign|noix|filet|zeste)/i;

/**
 * Quantité recalculée pour un autre nombre de portions, arrondie de façon
 * naturelle selon l'unité : 4 carottes → 5 carottes (et non 5,33),
 * 2 c. à s. → 2,5 c. à s., 333 g → 330 g, 1,2 kg → 1,6 kg.
 */
export function ajusterQuantite(quantite: number, facteur: number, unite = ''): number {
  if (facteur === 1) return quantite;
  const q = quantite * facteur;
  const u = unite.trim();
  if (!u) {
    // Ce qui se compte (œufs, carottes…) : entier, sauf si la recette donnait déjà une fraction
    return Number.isInteger(quantite) ? Math.max(1, Math.round(q)) : Math.max(0.5, Math.round(q * 2) / 2);
  }
  if (UNITES_PAR_DEMI.test(u)) return Math.max(0.5, Math.round(q * 2) / 2);
  if (q >= 200) return Math.round(q / 10) * 10;
  if (q >= 50) return Math.round(q / 5) * 5;
  if (q >= 10) return Math.round(q);
  if (q >= 2) return Math.round(q * 4) / 4;
  return Math.round(q * 100) / 100;
}

/** Partage un texte (feuille de partage du téléphone, sinon copie). Renvoie ce qui a été fait. */
export async function partagerTexte(titre: string, texte: string): Promise<'partage' | 'copie' | 'annule'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titre, text: texte });
      return 'partage';
    } catch {
      return 'annule';
    }
  }
  await navigator.clipboard.writeText(texte);
  return 'copie';
}
