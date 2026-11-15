// Types de données partagés par toute l'application.
// Ils correspondent aux tables Supabase (voir supabase/01_base.sql).

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

/** Symbole attribué par défaut à une recette selon sa catégorie. */
export const SYMBOLE_PAR_CATEGORIE: Record<Categorie, NomSymbole> = {
  Entrées: 'feuille',
  Plats: 'chaudron',
  Desserts: 'lune',
  Boissons: 'coupe',
  Autres: 'etoile',
};

export interface Ingredient {
  /** Quantité pour le nombre de portions de base (null = « à volonté »). */
  quantite: number | null;
  unite: string;
  nom: string;
}

export interface Etape {
  texte: string;
  /** Identifiant de l'image optionnelle de l'étape. */
  image?: string;
}

/** Champs communs aux données synchronisées avec le cloud. */
export interface Synchronisable {
  id: string;
  proprietaireId: string;
  /** Dates au format ISO. La modification la plus récente l'emporte. */
  creeLe: string;
  modifieLe: string;
  /** Suppression « douce » : la ligne est gardée pour propager la suppression. */
  supprimeLe?: string | null;
  /** Vrai tant que la modification locale n'a pas été envoyée au cloud. */
  aSynchroniser?: boolean;
}

export interface Recette extends Synchronisable {
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
  /** Identifiants d'images (voir donnees/images.ts). */
  photoPrincipale?: string | null;
  galerie: string[];
}

export interface Livre extends Synchronisable {
  titre: string;
  /** Couleur du cuir de la couverture (hex). */
  couleurCuir: string;
  symbole: NomSymbole;
  /** Identifiant d'une image de couverture ; elle remplace alors le symbole. */
  imageCouverture?: string | null;
}

/** Ce qu'il faut d'un livre pour dessiner sa couverture. */
export type ApparenceLivre = Pick<Livre, 'titre' | 'couleurCuir' | 'symbole'>;

/** Couleurs de cuir proposées pour les couvertures. */
export const COULEURS_CUIR = [
  '#5a2415', // brun-rouge
  '#3d2a1a', // brun
  '#6b1a1a', // rouge
  '#7a5a1e', // ocre
  '#1f3b2d', // vert
  '#1e2f4f', // bleu
  '#4a1f3d', // prune
  '#2b2b2b', // noir
] as const;

export const SYMBOLES: NomSymbole[] = ['chaudron', 'feuille', 'etoile', 'coupe', 'epi', 'flamme', 'poisson', 'lune'];
