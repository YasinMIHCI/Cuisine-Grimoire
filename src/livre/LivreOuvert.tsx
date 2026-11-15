import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Livre, Recette } from '../types';
import { repartirEnPages } from '../utilitaires/pagination';
import { Sommaire } from '../composants/Sommaire';
import { construireBlocsRecette } from './blocsRecette';
import { PageRecette } from './PageRecette';
import { TourneurDePages, type Transition } from './TourneurDePages';

// --- Réglages des animations ------------------------------------------------
/** Ouverture d'un chapitre : 6 feuilles qui défilent, 2 s au total. */
const OUVERTURE_CHAPITRE: Transition = { sens: 'avant', intercalaires: 5, duree: 0.75, decalage: 0.25 };
/** Retour au sommaire : défilement plus bref, en sens inverse (~1 s). */
const RETOUR_SOMMAIRE: Transition = { sens: 'arriere', intercalaires: 2, duree: 0.6, decalage: 0.2 };
/** Page tournée à la main (< 1 s). */
const PAGE_SUIVANTE: Transition = { sens: 'avant', intercalaires: 0, duree: 0.7, decalage: 0 };
const PAGE_PRECEDENTE: Transition = { sens: 'arriere', intercalaires: 0, duree: 0.7, decalage: 0 };

type Vue = { type: 'sommaire' } | { type: 'recette'; id: string; page: number };

interface Navigation {
  vue: Vue;
  /** Animation à jouer pour arriver sur cette vue. */
  transition: Transition | null;
}

interface Props {
  livre: Livre;
  recettes: Recette[];
}

/**
 * Un livre ouvert : sommaire, pages de recettes, pagination automatique,
 * pages qui tournent (swipe, tap sur les bords, flèches du clavier) et
 * gestion du bouton « retour » d'Android.
 */
export function LivreOuvert({ livre, recettes }: Props) {
  const [navigation, setNavigation] = useState<Navigation>({
    vue: { type: 'sommaire' },
    transition: null,
  });
  const { vue } = navigation;
  const recette = vue.type === 'recette' ? recettes.find((r) => r.id === vue.id) : undefined;

  // ---------------------------------------------------------------- Pagination
  const blocs = useMemo(() => (recette ? construireBlocsRecette(recette) : []), [recette]);
  const refMesure = useRef<HTMLDivElement>(null);
  const refCadre = useRef<HTMLDivElement>(null);
  /** Résultat de la pagination, rattaché à la recette mesurée. */
  const [pagination, setPagination] = useState<{ id: string; pages: number[][] } | null>(null);
  /** Incrémenté quand il faut re-mesurer (taille d'écran, polices chargées). */
  const [versionMesure, setVersionMesure] = useState(0);
  /** Premier bloc de la page affichée : sert à rester au même endroit après un redimensionnement. */
  const blocAncre = useRef(0);
  /** Vrai pendant une animation : on ignore alors les demandes de page tournée. */
  const animationEnCours = useRef(false);

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

  // ---------------------------------------------------------------- Navigation
  const defilementSommaire = useRef(0);

  const allerA = useCallback((nouvelleVue: Vue, transition: Transition) => {
    animationEnCours.current = true;
    setNavigation({ vue: nouvelleVue, transition });
  }, []);

  const ouvrirRecette = (id: string) => {
    // Une entrée d'historique par recette ouverte : le « retour » d'Android
    // (bouton ou geste depuis le bord) ramène au sommaire au lieu de quitter l'appli.
    window.history.pushState({ recette: id }, '');
    blocAncre.current = 0;
    allerA({ type: 'recette', id, page: 0 }, OUVERTURE_CHAPITRE);
  };

  // Le ruban fait la même chose que le bouton retour du téléphone
  const retourSommaire = () => window.history.back();

  useEffect(() => {
    // Au démarrage on est toujours sur le sommaire : on nettoie un éventuel reste d'historique
    if (window.history.state?.recette) window.history.replaceState(null, '');

    const surChangementHistorique = (evenement: PopStateEvent) => {
      const id: unknown = evenement.state?.recette;
      if (typeof id === 'string' && recettes.some((r) => r.id === id)) {
        // Bouton « suivant » du navigateur : on rouvre la recette
        blocAncre.current = 0;
        allerA({ type: 'recette', id, page: 0 }, OUVERTURE_CHAPITRE);
      } else {
        allerA({ type: 'sommaire' }, RETOUR_SOMMAIRE);
      }
    };
    window.addEventListener('popstate', surChangementHistorique);
    return () => window.removeEventListener('popstate', surChangementHistorique);
  }, [recettes, allerA]);

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

  // Clavier (PC) : flèches pour tourner les pages, Échap pour le sommaire
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
  const cle = vue.type === 'sommaire' ? 'sommaire' : `recette:${vue.id}:${vue.page}`;

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
        {vue.type === 'recette' && recette ? (
          <PageRecette
            recette={recette}
            blocs={(pages?.[vue.page] ?? []).map((i) => blocs[i])}
            numero={vue.page + 1}
            total={nombrePages}
            surRetourSommaire={retourSommaire}
          />
        ) : (
          <Sommaire
            livre={livre}
            recettes={recettes}
            surOuvrirRecette={ouvrirRecette}
            defilementInitial={defilementSommaire.current}
            surDefilement={(position) => (defilementSommaire.current = position)}
          />
        )}
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
              refContenu={refMesure}
            />
          </div>
        </div>
      )}
    </div>
  );
}
