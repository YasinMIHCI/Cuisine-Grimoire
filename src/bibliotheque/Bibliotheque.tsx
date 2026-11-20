import { useEffect, useMemo, useRef, useState } from 'react';
import { ContexteDepot, useDepot, useEtatDepot } from '../donnees/contexte';
import { Depot } from '../donnees/depot';
import { LivreOuvert } from '../livre/LivreOuvert';
import { FournisseurSocial } from '../amis/contexte';
import { CLE_INVITATION, EcranAmis, type Onglet } from '../amis/EcranAmis';
import { Etagere } from './Etagere';

/** Clé de stockage de l'apparence du dernier livre ouvert (pour l'intro). */
export const CLE_DERNIER_LIVRE = 'grimoire:dernier-livre';
/** Clé de stockage de l'identifiant du dernier livre ouvert, par compte. */
const cleDernierId = (uid: string) => `grimoire:dernier-livre-id:${uid}`;

/**
 * Charge les données du compte connecté, lance la synchronisation, puis
 * affiche l'étagère, un livre ouvert ou le cercle des amis.
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
      <FournisseurSocial uid={uid} actif={depot.enLigne}>
        <Navigation />
      </FournisseurSocial>
    </ContexteDepot.Provider>
  );
}

/** Écran principal affiché. */
type Ecran =
  | { type: 'etagere' }
  /** depuisEtagere : le livre a été ouvert depuis l'étagère (le retour y ramène). */
  | { type: 'livre'; id: string; recette?: string; depuisEtagere?: boolean }
  | { type: 'amis'; onglet: Onglet };

/**
 * Passe de l'étagère à un livre ou au cercle des amis, et inversement.
 * L'étagère est la « racine » de l'historique du navigateur : chaque écran
 * ouvert ajoute une entrée, si bien que le retour d'Android ramène en arrière.
 */
function Navigation() {
  const depot = useDepot();
  const { livres, recettes } = useEtatDepot();
  const refLivres = useRef(livres);
  refLivres.current = livres;

  // Au lancement, on rouvre le dernier livre consulté (s'il existe toujours) ;
  // au tout premier lancement, on arrive sur l'étagère.
  const [ecran, setEcran] = useState<Ecran>(() => {
    const id = localStorage.getItem(cleDernierId(depot.uid));
    return id && livres.some((l) => l.id === id) ? { type: 'livre', id, depuisEtagere: true } : { type: 'etagere' };
  });

  const historiquePret = useRef(false);
  useEffect(() => {
    if (!historiquePret.current) {
      historiquePret.current = true;
      window.history.replaceState(null, '');
      if (ecran.type === 'livre') window.history.pushState({ livre: ecran.id }, '');
      // Lien d'invitation ouvert : direction le cercle des amis
      if (depot.enLigne && localStorage.getItem(CLE_INVITATION)) ouvrirAmis('amis');
    }
    const surChangementHistorique = (evenement: PopStateEvent) => {
      const etat = evenement.state as { livre?: string; amis?: boolean; onglet?: Onglet } | null;
      setEcran((actuel) => {
        if (etat?.amis) return actuel.type === 'amis' ? actuel : { type: 'amis', onglet: etat.onglet ?? 'courrier' };
        const id = etat?.livre;
        if (id && refLivres.current.some((l) => l.id === id)) {
          return actuel.type === 'livre' && actuel.id === id ? actuel : { type: 'livre', id };
        }
        return actuel.type === 'etagere' ? actuel : { type: 'etagere' };
      });
    };
    window.addEventListener('popstate', surChangementHistorique);
    return () => window.removeEventListener('popstate', surChangementHistorique);
    // (mise en place une seule fois)
  }, []);

  const ouvrirLivre = (id: string, recette?: string) => {
    window.history.pushState({ livre: id }, '');
    localStorage.setItem(cleDernierId(depot.uid), id);
    setEcran((actuel) => ({ type: 'livre', id, recette, depuisEtagere: actuel.type === 'etagere' }));
  };

  function ouvrirAmis(onglet: Onglet = 'courrier') {
    window.history.pushState({ amis: true, onglet }, '');
    setEcran({ type: 'amis', onglet });
  }

  /** Ouvre la recette de la bibliothèque qui a cette origine (depuis le fil d'activité). */
  const ouvrirOrigine = (origineId: string) => {
    const recette = recettes.find((r) => r.origineId === origineId);
    if (recette) ouvrirLivre(recette.livreId, recette.id);
    else window.alert('Cette recette n’est plus dans votre bibliothèque.');
  };

  const livre = ecran.type === 'livre' ? livres.find((l) => l.id === ecran.id) : undefined;

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

  if (ecran.type === 'amis') {
    return (
      <EcranAmis
        ongletInitial={ecran.onglet}
        surRetour={() => window.history.back()}
        surOuvrirOrigine={ouvrirOrigine}
        surOuvrirLivre={(id) => ouvrirLivre(id)}
      />
    );
  }
  if (livre && ecran.type === 'livre') {
    return (
      <LivreOuvert
        key={livre.id}
        livre={livre}
        recettes={recettes.filter((r) => r.livreId === livre.id)}
        recetteInitiale={ecran.recette}
        surEtagere={() => {
          if (ecran.depuisEtagere) {
            window.history.back(); // on revient sur nos pas
          } else {
            // Livre ouvert depuis une recherche ou le courrier : on va à l'étagère
            window.history.pushState(null, '');
            setEcran({ type: 'etagere' });
          }
        }}
        surAmis={() => ouvrirAmis()}
        surOuvrirAilleurs={ouvrirLivre}
      />
    );
  }
  return (
    <Etagere
      livres={livres}
      nombreRecettes={nombreRecettes}
      surOuvrir={(id) => ouvrirLivre(id)}
      surOuvrirRecette={ouvrirLivre}
      surAmis={() => ouvrirAmis()}
    />
  );
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
