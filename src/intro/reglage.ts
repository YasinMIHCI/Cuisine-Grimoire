// Réglage de l'intro animée : à chaque lancement, une fois par jour, ou jamais.

export type ReglageIntro = 'toujours' | 'jour' | 'jamais';

const CLE = 'grimoire:intro';
const CLE_DERNIERE = 'grimoire:intro-derniere';

export function lireReglageIntro(): ReglageIntro {
  try {
    const valeur = localStorage.getItem(CLE);
    if (valeur === 'toujours' || valeur === 'jour' || valeur === 'jamais') return valeur;
  } catch {
    // stockage indisponible
  }
  return 'jour';
}

export function ecrireReglageIntro(reglage: ReglageIntro) {
  try {
    localStorage.setItem(CLE, reglage);
  } catch {
    // stockage indisponible : le réglage ne sera pas retenu
  }
}

const aujourdHui = () => new Date().toLocaleDateString('fr-CA'); // AAAA-MM-JJ, heure locale

/**
 * Faut-il jouer l'intro à ce lancement ? On la saute quand on arrive par un
 * lien d'invitation (on veut agir tout de suite).
 */
export function introAJouer(arriveeParInvitation: boolean): boolean {
  if (arriveeParInvitation) return false;
  const reglage = lireReglageIntro();
  if (reglage === 'jamais') return false;
  if (reglage === 'toujours') return true;
  try {
    if (localStorage.getItem(CLE_DERNIERE) === aujourdHui()) return false;
    localStorage.setItem(CLE_DERNIERE, aujourdHui());
  } catch {
    // stockage indisponible : on la joue
  }
  return true;
}
