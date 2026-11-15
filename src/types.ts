// Types de données partagés par toute l'application.
// Ils préfigurent les tables Supabase (étape d).

/** Catégories d'un sommaire, dans l'ordre d'affichage. */
export const CATEGORIES = ['Entrées', 'Plats', 'Desserts', 'Boissons', 'Autres'] as const;
export type Categorie = (typeof CATEGORIES)[number];

/** Symboles dessinés en SVG (couvertures et vignettes par défaut). */
export type NomSymbole =
  | 'chaudron'
  | 'feuille'
  | 'etoile'
  | 'coupe'
  | 'epi'
  | 'flamme'
  | 'poisson'
  | 'lune';

export interface Ingredient {
  /** Quantité pour le nombre de portions de base (null = « à volonté »). */
  quantite: number | null;
  unite: string;
  nom: string;
}

export interface Etape {
  texte: string;
  /** Image optionnelle de l'étape (URL) — branchée à l'étape (d). */
  image?: string;
}

export interface Recette {
  id: string;
  livreId: string;
  titre: string;
  categorie: Categorie;
  /** Durées en minutes. */
  tempsPreparation: number;
  tempsCuisson: number;
  portions: number;
  ingredients: Ingredient[];
  etapes: Etape[];
  notes: string;
  favori: boolean;
  /** Vignette par défaut tant qu'il n'y a pas de photo principale. */
  symbole: NomSymbole;
  photoPrincipale?: string;
}

export interface Livre {
  id: string;
  titre: string;
  /** Couleur du cuir de la couverture (hex). */
  couleurCuir: string;
  symbole: NomSymbole;
}
