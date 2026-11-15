import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Livre, Recette } from '../types';
import { repartirEnPages } from '../utilitaires/pagination';
import { PanneauCompte } from '../composants/PanneauCompte';
import { Sommaire } from '../composants/Sommaire';
import { Visionneuse } from '../composants/Visionneuse';
import { FormulaireRecette } from '../recette/FormulaireRecette';
import { construireBlocsRecette } from './blocsRecette';
import { PageRecette } from './PageRecette';
import { TourneurDePages, type Transition } from './TourneurDePages';

// --- Réglages des animations ------------------------------------------------
/** Ouverture d'un chapitre : une douzaine de pages défilent à toute vitesse (~1 s). */
const OUVERTURE_CHAPITRE: Transition = { sens: 'avant', intercalaires: 12, duree: 0.38, decalage: 0.054 };
/** Retour au sommaire : défilement plus bref, en sens inverse (~0,7 s). */
const RETOUR_SOMMAIRE: Transition = { sens: 'arriere', intercalaires: 5, duree: 0.38, decalage: 0.06 };
/** Page tournée à la main (< 1 s). */
const PAGE_SUIVANTE: Transition = { sens: 'avant', intercalaires: 0, duree: 0.7, decalage: 0 };
const PAGE_PRECEDENTE: Transition = { sens: 'arriere', intercalaires: 0, duree: 0.7, decalage: 0 };

/** Les écrans d'un livre. `edition` avec id null = nouvelle recette. */
type Vue =
  | { type: 'sommaire' }
  | { type: 'recette'; id: string; page: number }
  | { type: 'edition'; id: string | null };

/** Identifie un écran, sans tenir compte du numéro de page. */
const ecranDe = (vue: Vue) => (vue.type === 'sommaire' ? 'sommaire' : `${vue.type}:${vue.id}`);

interface Navigation {
  vue: Vue;
  /** Animation à jouer pour arriver sur cette vue. */
  transition: Transition | null;
}

/** Ce qu'on range dans l'historique du navigateur pour chaque écran. */
interface EtatHistorique {
  vue?: Vue;
  image?: string;
}

interface Props {
  livre: Livre;
  /** Les recettes de ce livre. */
  recettes: Recette[];
}

/**
 * Un livre ouvert : sommaire, pages de recettes, formulaire, pagination
 * automatique, pages qui tournent (swipe, tap sur les bords, flèches du clavier)
 * et gestion du bouton « retour » d'Android.
 */
export function LivreOuvert({ livre, recettes }: Props) {
  const [navigation, setNavigation] = useState<Navigation>({
    vue: { type: 'sommaire' },
    transition: null,
  });
  const { vue } = navigation;
  const recette = vue.type === 'recette' ? recettes.find((r) => r.id === vue.id) : undefined;
  /** Image agrandie en plein écran, le cas échéant. */
  const [imageAgrandie, setImageAgrandie] = useState<string | null>(null);
  const [compteOuvert, setCompteOuvert] = useState(false);

  // Valeurs toujours à jour pour les écouteurs d'événements
  const refVue = useRef(vue);
  refVue.current = vue;
  const refRecettes = useRef(recettes);
  refRecettes.current = recettes;

  // ---------------------------------------------------------------- Navigation
  /** Vrai pendant une animation : on ignore alors les demandes de page tournée. */
  const animationEnCours = useRef(false);
  const defilementSommaire = useRef(0);
  /** Premier bloc de la page affichée : sert à rester au même endroit après un redimensionnement. */
  const blocAncre = useRef(0);

  const allerA = useCallback((nouvelleVue: Vue, transition: Transition) => {
    animationEnCours.current = true;
    setNavigation({ vue: nouvelleVue, transition });
  }, []);

  /**
   * Ouvre un nouvel écran. Chaque écran ouvert ajoute une entrée à l'historique :
   * le « retour » d'Android (bouton ou geste depuis le bord) ramène à l'écran
   * précédent au lieu de quitter l'appli.
   */
  const ouvrir = useCallback(
    (nouvelleVue: Vue, transition: Transition) => {
      window.history.pushState({ vue: nouvelleVue } satisfies EtatHistorique, '');
      blocAncre.current = 0;
      allerA(nouvelleVue, transition);
    },
    [allerA],
  );

  // Rubans, « Annuler », fermeture d'image : même effet que le bouton retour
  const retour = () => window.history.back();

  const agrandirImage = useCallback((id: string) => {
    window.history.pushState({ vue: refVue.current, image: id } satisfies EtatHistorique, '');
    setImageAgrandie(id);
  }, []);

  useEffect(() => {
    // Au démarrage on est toujours sur le sommaire : on nettoie un éventuel reste d'historique
    if (window.history.state) window.history.replaceState(null, '');

    const surChangementHistorique = (evenement: PopStateEvent) => {
      const etat = (evenement.state ?? {}) as EtatHistorique;
      setImageAgrandie(etat.image ?? null);

      let cible: Vue = etat.vue ?? { type: 'sommaire' };
      // Une recette supprimée entre-temps n'existe plus : retour au sommaire
      const idCible = cible.type === 'sommaire' ? null : cible.id;
      if (idCible !== null && !refRecettes.current.some((r) => r.id === idCible)) {
        cible = { type: 'sommaire' };
      }
      if (cible.type === 'recette') cible = { ...cible, page: 0 };

      const depart = refVue.current;
      if (ecranDe(cible) === ecranDe(depart)) return; // on a seulement refermé une image
      blocAncre.current = 0;
      allerA(cible, depart.type === 'recette' && cible.type === 'sommaire' ? RETOUR_SOMMAIRE : PAGE_PRECEDENTE);
    };
    window.addEventListener('popstate', surChangementHistorique);
    return () => window.removeEventListener('popstate', surChangementHistorique);
  }, [allerA]);

  // ---------------------------------------------------------------- Pagination
  const blocs = useMemo(() => (recette ? construireBlocsRecette(recette, agrandirImage) : []), [recette, agrandirImage]);
  const refMesure = useRef<HTMLDivElement>(null);
  const refCadre = useRef<HTMLDivElement>(null);
  /** Résultat de la pagination, rattaché à la recette mesurée. */
  const [pagination, setPagination] = useState<{ id: string; pages: number[][] } | null>(null);
  /** Incrémenté quand il faut re-mesurer (taille d'écran, polices chargées). */
  const [versionMesure, setVersionMesure] = useState(0);

  useEffect(() => {
    const remesurer = () => setVersionMesure((v) => v + 1);
    const observateur = new ResizeObserver(remesurer);
    if (refCadre.current) observateur.observe(refCadre.current);
    // Les polices changent la hauteur du texte : on re-mesure une fois chargées
    document.fonts?.ready.then(remesurer);
    return () => observateur.disconnect();
  }, []);

  // Mesure des blocs dans une page invisible, puis répartition sur les pages.
  // useLayoutEffect : le calcul se fait avant l'affichage, sans clignotement.
  useLayoutEffect(() => {
    const contenu = refMesure.current;
    if (!recette || !contenu) return;
    const hauteurs = Array.from(contenu.children, (e) => e.getBoundingClientRect().height);
    const pages = repartirEnPages(
      hauteurs,
      blocs.map((b) => b.lieAuSuivant === true),
      contenu.clientHeight,
    );
    setPagination((ancienne) =>
      ancienne && ancienne.id === recette.id && JSON.stringify(ancienne.pages) === JSON.stringify(pages)
        ? ancienne
        : { id: recette.id, pages },
    );
    // Si le découpage a changé, on retrouve la page qui contient le même passage
    const pageAncre = pages.findIndex((p) => p.includes(blocAncre.current));
    if (vue.type === 'recette' && pageAncre >= 0 && vue.page !== pageAncre) {
      animationEnCours.current = false; // ce changement de page est immédiat
    }
    setNavigation((nav) =>
      nav.vue.type === 'recette' && pageAncre >= 0 && nav.vue.page !== pageAncre
        ? { vue: { ...nav.vue, page: pageAncre }, transition: null }
        : nav,
    );
  }, [recette, blocs, versionMesure, vue]);

  const pages = recette && pagination?.id === recette.id ? pagination.pages : null;
  const nombrePages = pages?.length ?? 1;

  /** Tourne une page : +1 = suivante, -1 = précédente. */
  const tourner = useCallback(
    (pas: 1 | -1) => {
      if (vue.type !== 'recette' || !pages || animationEnCours.current) return;
      const cible = vue.page + pas;
      if (cible < 0 || cible >= pages.length) return;
      blocAncre.current = pages[cible][0] ?? 0;
      allerA({ ...vue, page: cible }, pas === 1 ? PAGE_SUIVANTE : PAGE_PRECEDENTE);
    },
    [vue, pages, allerA],
  );

  // Clavier (PC) : flèches pour tourner les pages, Échap pour revenir en arrière
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (vue.type !== 'recette') return;
      if (e.key === 'ArrowRight') tourner(1);
      else if (e.key === 'ArrowLeft') tourner(-1);
      else if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [vue.type, tourner]);

  // Gestes : swipe horizontal, ou tap sur le bord gauche / droit de la page
  const depart = useRef<{ x: number; y: number; t: number } | null>(null);

  const surAppui = (e: React.PointerEvent) => {
    const surBouton = (e.target as Element).closest('button, a, input, textarea, select');
    depart.current = surBouton ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };

  const surRelachement = (e: React.PointerEvent) => {
    const d = depart.current;
    depart.current = null;
    if (!d || vue.type !== 'recette') return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // Swipe : vers la gauche = page suivante, comme dans un vrai livre
      tourner(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.timeStamp - d.t < 500) {
      // Tap : le quart gauche recule, le quart droit avance
      const cadre = e.currentTarget.getBoundingClientRect();
      const position = (e.clientX - cadre.left) / cadre.width;
      if (position < 0.28) tourner(-1);
      else if (position > 0.72) tourner(1);
    }
  };

  // ------------------------------------------------------------------- Rendu
  const cle = vue.type === 'recette' ? `recette:${vue.id}:${vue.page}` : ecranDe(vue);

  let page;
  if (vue.type === 'recette' && recette) {
    page = (
      <PageRecette
        recette={recette}
        blocs={(pages?.[vue.page] ?? []).map((i) => blocs[i])}
        numero={vue.page + 1}
        total={nombrePages}
        surRetourSommaire={retour}
        surModifier={() => ouvrir({ type: 'edition', id: recette.id }, PAGE_SUIVANTE)}
      />
    );
  } else if (vue.type === 'edition') {
    page = (
      <FormulaireRecette
        recette={recettes.find((r) => r.id === vue.id) ?? null}
        livreId={livre.id}
        surTermine={retour}
        // Recette supprimée : on saute par-dessus sa page pour revenir au sommaire
        surSupprimee={() => window.history.go(-2)}
      />
    );
  } else {
    page = (
      <Sommaire
        livre={livre}
        recettes={recettes}
        surOuvrirRecette={(id) => ouvrir({ type: 'recette', id, page: 0 }, OUVERTURE_CHAPITRE)}
        surNouvelleRecette={() => ouvrir({ type: 'edition', id: null }, PAGE_SUIVANTE)}
        surCompte={() => setCompteOuvert(true)}
        defilementInitial={defilementSommaire.current}
        surDefilement={(position) => (defilementSommaire.current = position)}
      />
    );
  }

  return (
    <div
      className="cadre-livre"
      ref={refCadre}
      onPointerDown={surAppui}
      onPointerUp={surRelachement}
      onPointerCancel={() => (depart.current = null)}
    >
      <TourneurDePages
        cle={cle}
        transition={navigation.transition}
        surFin={() => (animationEnCours.current = false)}
      >
        {page}
      </TourneurDePages>

      {/* Page de mesure, invisible : même taille et mêmes styles qu'une vraie page,
          elle contient tous les blocs de la recette pour connaître leur hauteur. */}
      {recette && (
        <div className="feuille feuille--mesure" aria-hidden="true" inert>
          <div className="feuille__recto parchemin">
            <PageRecette
              recette={recette}
              blocs={blocs}
              numero={1}
              total={1}
              surRetourSommaire={() => {}}
              surModifier={() => {}}
              refContenu={refMesure}
            />
          </div>
        </div>
      )}

      {imageAgrandie && <Visionneuse id={imageAgrandie} surFermer={retour} />}
      {compteOuvert && <PanneauCompte surFermer={() => setCompteOuvert(false)} />}
    </div>
  );
}
