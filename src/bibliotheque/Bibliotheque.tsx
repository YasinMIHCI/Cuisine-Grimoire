import { useEffect, useMemo, useRef, useState } from 'react';
import { ContexteDepot, useDepot, useEtatDepot } from '../donnees/contexte';
import { Depot } from '../donnees/depot';
import { LivreOuvert } from '../livre/LivreOuvert';
import { Etagere } from './Etagere';

/** Clé de stockage de l'apparence du dernier livre ouvert (pour l'intro). */
export const CLE_DERNIER_LIVRE = 'grimoire:dernier-livre';
/** Clé de stockage de l'identifiant du dernier livre ouvert, par compte. */
const cleDernierId = (uid: string) => `grimoire:dernier-livre-id:${uid}`;

/**
 * Charge les données du compte connecté, lance la synchronisation, puis
 * affiche l'étagère ou le livre ouvert.
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
      <Navigation />
    </ContexteDepot.Provider>
  );
}

/**
 * Passe de l'étagère à un livre et inversement.
 * L'étagère est la « racine » de l'historique du navigateur : ouvrir un livre
 * ajoute une entrée, si bien que le retour d'Android ramène à l'étagère.
 */
function Navigation() {
  const depot = useDepot();
  const { livres, recettes } = useEtatDepot();
  const refLivres = useRef(livres);
  refLivres.current = livres;

  // Au lancement, on rouvre le dernier livre consulté (s'il existe toujours) ;
  // au tout premier lancement, on arrive sur l'étagère.
  const [livreOuvertId, setLivreOuvertId] = useState<string | null>(() => {
    const id = localStorage.getItem(cleDernierId(depot.uid));
    return id && livres.some((l) => l.id === id) ? id : null;
  });

  const historiquePret = useRef(false);
  useEffect(() => {
    if (!historiquePret.current) {
      historiquePret.current = true;
      window.history.replaceState(null, '');
      if (livreOuvertId) window.history.pushState({ livre: livreOuvertId }, '');
    }
    const surChangementHistorique = (evenement: PopStateEvent) => {
      const id: unknown = evenement.state?.livre;
      setLivreOuvertId(typeof id === 'string' && refLivres.current.some((l) => l.id === id) ? id : null);
    };
    window.addEventListener('popstate', surChangementHistorique);
    return () => window.removeEventListener('popstate', surChangementHistorique);
    // (mise en place une seule fois)
  }, []);

  const ouvrirLivre = (id: string) => {
    window.history.pushState({ livre: id }, '');
    localStorage.setItem(cleDernierId(depot.uid), id);
    setLivreOuvertId(id);
  };

  const livre = livres.find((l) => l.id === livreOuvertId);

  // On retient l'apparence du livre ouvert pour la couverture de la prochaine intro
  useEffect(() => {
    if (!livre) return;
    let annule = false;
    const { titre, couleurCuir, symbole, imageCouverture } = livre;
    const memoriser = (miniature: string | null) => {
      if (!annule) localStorage.setItem(CLE_DERNIER_LIVRE, JSON.stringify({ titre, couleurCuir, symbole, miniature }));
    };
    if (!imageCouverture) memoriser(null);
    else void depot.adresseImage(imageCouverture).then(creerMiniature).then(memoriser);
    return () => {
      annule = true;
    };
  }, [livre, depot]);

  const nombreRecettes = useMemo(() => {
    const compte = new Map<string, number>();
    for (const r of recettes) compte.set(r.livreId, (compte.get(r.livreId) ?? 0) + 1);
    return compte;
  }, [recettes]);

  if (livre) {
    return (
      <LivreOuvert
        key={livre.id}
        livre={livre}
        recettes={recettes.filter((r) => r.livreId === livre.id)}
        surEtagere={() => window.history.back()}
      />
    );
  }
  return <Etagere livres={livres} nombreRecettes={nombreRecettes} surOuvrir={ouvrirLivre} />;
}

/** Petite version (240 px) d'une image, sous forme de texte, pour l'intro. */
async function creerMiniature(adresse: string | null): Promise<string | null> {
  if (!adresse) return null;
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    const cote = 240;
    const toile = document.createElement('canvas');
    toile.width = toile.height = cote;
    // On recadre au centre, en carré
    const c = Math.min(image.width, image.height);
    toile.getContext('2d')!.drawImage(image, (image.width - c) / 2, (image.height - c) / 2, c, c, 0, 0, cote, cote);
    return toile.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
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
