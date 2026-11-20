// Répartition automatique du contenu d'une recette sur plusieurs pages.

/**
 * Répartit des blocs de hauteurs connues sur des pages de hauteur fixe.
 *
 * @param hauteurs    hauteur mesurée de chaque bloc (px)
 * @param liesAuSuivant  true si le bloc ne doit pas finir une page seul
 *                       (ex. un titre de section reste avec le bloc qui le suit)
 * @param hauteurPage hauteur disponible sur une page (px)
 * @param debutsPage  true si le bloc doit commencer une nouvelle page
 * @returns pour chaque page, la liste des indices de blocs qu'elle contient
 */
export function repartirEnPages(
  hauteurs: number[],
  liesAuSuivant: boolean[],
  hauteurPage: number,
  debutsPage: boolean[] = [],
): number[][] {
  const pages: number[][] = [];
  let pageEnCours: number[] = [];
  let hauteurUtilisee = 0;
  const tolerance = 1; // arrondis de mesure

  hauteurs.forEach((hauteur, i) => {
    // Un titre de section « réserve » aussi la place du bloc suivant
    const suivant = liesAuSuivant[i] && i + 1 < hauteurs.length ? hauteurs[i + 1] : 0;
    const necessaire = hauteur + suivant;

    const deborde = hauteurUtilisee + necessaire > hauteurPage + tolerance;
    if (pageEnCours.length > 0 && (deborde || debutsPage[i])) {
      pages.push(pageEnCours);
      pageEnCours = [];
      hauteurUtilisee = 0;
    }
    // Un bloc plus haut que la page est placé seul (il sera rogné) : cas extrême
    pageEnCours.push(i);
    hauteurUtilisee += hauteur;
  });

  pages.push(pageEnCours);
  return pages;
}
