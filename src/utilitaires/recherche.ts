// Recherche de recettes par titre et par ingrédient.
import type { Recette } from '../types';

/** Minuscules, sans accents ni ligatures : « Œufs brouillés » → « oeufs brouilles ». */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export interface Resultat {
  recette: Recette;
  /** Ingrédients qui correspondent à la recherche (si le titre ne suffit pas). */
  ingredients: string[];
}

/** Les mots d'un texte normalisé (« pâte brisée » → [« pate », « brisee »]). */
const decouper = (texte: string) => normaliser(texte).split(/[^a-z0-9]+/).filter(Boolean);

/** Vrai si l'un des mots commence par le mot cherché (« pomme » trouve « pommes », pas « œuf » dans « bœuf »). */
const commencePar = (mots: string[], cherche: string) => mots.some((m) => m.startsWith(cherche));

/**
 * Chaque mot cherché doit se trouver dans le titre ou dans un ingrédient :
 * « tarte pomme » trouve la tarte Tatin, qui contient des pommes.
 */
export function rechercher(recettes: Recette[], texte: string, favorisSeuls = false): Resultat[] {
  const mots = decouper(texte);
  const resultats: Resultat[] = [];
  for (const recette of recettes) {
    if (favorisSeuls && !recette.favori) continue;
    const titre = decouper(recette.titre);
    const ingredients = recette.ingredients.map((i) => ({ nom: i.nom, mots: decouper(i.nom) }));
    const trouves = new Set<string>();
    const correspond = mots.every((mot) => {
      if (commencePar(titre, mot)) return true;
      const ingredient = ingredients.find((i) => commencePar(i.mots, mot));
      if (ingredient) trouves.add(ingredient.nom);
      return ingredient !== undefined;
    });
    if (correspond) resultats.push({ recette, ingredients: [...trouves] });
  }
  return resultats;
}
