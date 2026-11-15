// Accès au dépôt de données depuis les composants React.
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { Depot } from './depot';

export const ContexteDepot = createContext<Depot | null>(null);

/** Le dépôt du compte connecté. */
export function useDepot(): Depot {
  const depot = useContext(ContexteDepot);
  if (!depot) throw new Error('useDepot doit être utilisé sous <ContexteDepot.Provider>');
  return depot;
}

/** Livres, recettes et état de synchronisation ; le composant se met à jour tout seul. */
export function useEtatDepot() {
  const depot = useDepot();
  return useSyncExternalStore(depot.abonner, depot.lireEtat);
}

/** Adresse affichable d'une image (null tant qu'elle n'est pas chargée). */
export function useAdresseImage(id: string | null | undefined): string | null {
  const depot = useDepot();
  const [adresse, setAdresse] = useState<string | null>(null);
  useEffect(() => {
    setAdresse(null);
    if (!id) return;
    let annule = false;
    void depot.adresseImage(id).then((a) => {
      if (!annule) setAdresse(a);
    });
    return () => {
      annule = true;
    };
  }, [depot, id]);
  return adresse;
}
