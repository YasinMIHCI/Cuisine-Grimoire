import { useEffect, useState } from 'react';
import { ContexteDepot, useEtatDepot } from '../donnees/contexte';
import { Depot } from '../donnees/depot';
import { LivreOuvert } from './LivreOuvert';

/** Clé de stockage de l'apparence du dernier livre ouvert (pour l'intro). */
export const CLE_DERNIER_LIVRE = 'grimoire:dernier-livre';

/**
 * Charge les données du compte connecté, lance la synchronisation et affiche
 * le livre courant. (L'étagère multi-livres arrive à l'étape e.)
 */
export function Bibliotheque({ uid }: { uid: string }) {
  const [depot, setDepot] = useState<Depot | null>(null);

  useEffect(() => {
    let annule = false;
    let ouvert: Depot | null = null;
    const synchroniser = () => void ouvert?.synchroniser();
    const auRetour = () => document.visibilityState === 'visible' && synchroniser();

    void Depot.ouvrir(uid).then((d) => {
      if (annule) return;
      ouvert = d;
      setDepot(d);
      synchroniser();
    });
    // On resynchronise au retour du réseau et au retour au premier plan
    window.addEventListener('online', synchroniser);
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      annule = true;
      window.removeEventListener('online', synchroniser);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [uid]);

  if (!depot) return <PageAttente />;
  return (
    <ContexteDepot.Provider value={depot}>
      <LivreCourant />
    </ContexteDepot.Provider>
  );
}

function LivreCourant() {
  const { livres, recettes } = useEtatDepot();
  const livre = livres[0];

  // On retient l'apparence du livre pour la couverture de la prochaine intro
  useEffect(() => {
    if (!livre) return;
    const { titre, couleurCuir, symbole } = livre;
    localStorage.setItem(CLE_DERNIER_LIVRE, JSON.stringify({ titre, couleurCuir, symbole }));
  }, [livre]);

  // Premier lancement d'un compte : le premier livre est créé par la synchronisation
  if (!livre) return <PageAttente />;
  return <LivreOuvert key={livre.id} livre={livre} recettes={recettes.filter((r) => r.livreId === livre.id)} />;
}

/** Page de parchemin vide, affichée pendant le chargement. */
export function PageAttente() {
  return (
    <div className="cadre-livre">
      <div className="feuille">
        <div className="feuille__recto parchemin">
          <p className="page__attente">Le grimoire s’ouvre…</p>
        </div>
      </div>
    </div>
  );
}
