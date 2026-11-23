// Panneaux (fenêtres par-dessus l'écran) et bouton « retour » d'Android.
import { useEffect, useRef } from 'react';

/**
 * À utiliser dans un panneau : son ouverture ajoute une entrée à l'historique
 * du navigateur, si bien que le geste « retour » le referme au lieu de quitter
 * l'écran. Renvoie la fonction à appeler pour le refermer soi-même (bouton
 * « Fermer », fond assombri…) : elle passe aussi par l'historique.
 */
export function usePanneauHistorique(surFermer: () => void): () => void {
  const refSurFermer = useRef(surFermer);
  refSurFermer.current = surFermer;

  const refMarque = useRef<string>(null);
  refMarque.current ??= crypto.randomUUID();

  useEffect(() => {
    const marque = refMarque.current!;
    // On garde l'état courant (livre, vue…) et on y ajoute la marque du panneau.
    // (En développement, React lance l'effet deux fois : une seule entrée suffit.)
    if (window.history.state?.panneau !== marque) {
      window.history.pushState({ ...window.history.state, panneau: marque }, '');
    }
    const surRetour = () => {
      // Notre entrée n'est plus la courante : on a reculé, le panneau se ferme
      if (window.history.state?.panneau !== marque) refSurFermer.current();
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  return () => window.history.back();
}
