// Fenêtres par-dessus l'écran : le focus du clavier y reste enfermé, Échap les
// referme, et le focus revient à l'élément de départ à la fermeture.
import { useEffect, useRef } from 'react';

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Éléments qui peuvent recevoir le focus dans un conteneur (visibles seulement). */
export function elementsFocalisables(conteneur: HTMLElement): HTMLElement[] {
  return Array.from(conteneur.querySelectorAll<HTMLElement>(FOCALISABLES)).filter(
    (e) => !e.hidden && e.getClientRects().length > 0,
  );
}

/** Fenêtres ouvertes, de la plus ancienne à la plus récente : seule la dernière réagit. */
const pile: HTMLElement[] = [];

/**
 * À poser sur le conteneur d'une fenêtre (panneau, mode cuisine…).
 * @param surEchap appelé à l'appui sur Échap (fermeture)
 */
export function usePiegeFocus<T extends HTMLElement>(surEchap?: () => void) {
  const ref = useRef<T>(null);
  const refEchap = useRef(surEchap);
  refEchap.current = surEchap;

  useEffect(() => {
    const conteneur = ref.current;
    if (!conteneur) return;
    const precedent = document.activeElement as HTMLElement | null;
    // Focus sur le premier champ, sinon sur la fenêtre elle-même
    const premier = elementsFocalisables(conteneur).find((e) => e.matches('input, select, textarea'));
    if (!conteneur.hasAttribute('tabindex')) conteneur.tabIndex = -1;
    (premier ?? conteneur).focus({ preventScroll: true });
    pile.push(conteneur);

    const surTouche = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== conteneur) return; // une autre fenêtre est par-dessus
      if (e.key === 'Escape' && refEchap.current) {
        e.preventDefault();
        e.stopPropagation();
        refEchap.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const liste = elementsFocalisables(conteneur);
      if (liste.length === 0) {
        e.preventDefault();
        return;
      }
      const debut = liste[0];
      const fin = liste[liste.length - 1];
      const actif = document.activeElement;
      if (e.shiftKey && (actif === debut || actif === conteneur)) {
        e.preventDefault();
        fin.focus();
      } else if (!e.shiftKey && actif === fin) {
        e.preventDefault();
        debut.focus();
      } else if (!conteneur.contains(actif)) {
        e.preventDefault();
        debut.focus();
      }
    };
    document.addEventListener('keydown', surTouche, true);
    return () => {
      document.removeEventListener('keydown', surTouche, true);
      pile.splice(pile.indexOf(conteneur), 1);
      if (precedent?.isConnected) precedent.focus({ preventScroll: true });
    };
  }, []);

  return ref;
}
