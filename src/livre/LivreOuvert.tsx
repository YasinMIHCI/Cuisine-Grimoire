import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Livre, Recette } from '../types';
import { repartirEnPages } from '../utilitaires/pagination';
import { PanneauCompte } from '../composants/PanneauCompte';
import { Sommaire, type FiltreSommaire } from '../composants/Sommaire';
import { Visionneuse } from '../composants/Visionneuse';
import { useDepot } from '../donnees/contexte';
import { useSocial } from '../amis/contexte';
import { PanneauRealisation, useRealisations } from '../amis/realisations';
import type { SourceEnvoi } from '../amis/social';
import { construireBlocsRecette } from './blocsRecette';
import { PageRecette } from './PageRecette';
import { TourneurDePages, type Transition } from './TourneurDePages';

// Écrans chargés à la demande (allège le premier chargement)
const FormulaireRecette = lazy(() => import('../recette/FormulaireRecette').then((m) => ({ default: m.FormulaireRecette })));
const ModeCuisine = lazy(() => import('../cuisine/ModeCuisine').then((m) => ({ default: m.ModeCuisine })));
const PanneauTransmettre = lazy(() => import('../amis/PanneauTransmettre').then((m) => ({ default: m.PanneauTransmettre })));

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
  /** Livre ouvert (géré par Bibliotheque). */
  livre?: string;
  vue?: Vue;
}

/** Fenêtre affichée par-dessus le livre. */
type Superpose =
  | { type: 'image'; id: string }
  | { type: 'photo'; adresse: string }
  | { type: 'cuisine' }
  | { type: 'transmettre'; source: SourceEnvoi }
  | { type: 'realisation' }
  | { type: 'compte' };

interface Props {
  livre: Livre;
  /** Les recettes de ce livre. */
  recettes: Recette[];
  /** Recette à ouvrir dès l'arrivée (depuis une recherche ou le fil d'activité). */
  recetteInitiale?: string;
  /** Retour à l'étagère. */
  surEtagere: () => void;
  /** Ouvre le cercle des amis. */
  surAmis: () => void;
  /** Ouvre une recette d'un autre livre. */
  surOuvrirAilleurs: (livreId: string, recetteId: string) => void;
}

/** Vue de départ : celle de l'historique si on revient sur ce livre, sinon le sommaire. */
function vueInitiale(livreId: string, recettes: Recette[]): Vue {
  const etat = window.history.state as EtatHistorique | null;
  const vue = etat?.livre === livreId ? etat.vue : undefined;
  if (vue?.type === 'recette' && recettes.some((r) => r.id === vue.id)) return { ...vue, page: 0 };
  return { type: 'sommaire' };
}

/**
 * Un livre ouvert : sommaire, pages de recettes, formulaire, pagination
 * automatique, pages qui tournent (swipe, tap sur les bords, flèches du clavier)
 * et gestion du bouton « retour » d'Android.
 */
export function LivreOuvert({ livre, recettes, recetteInitiale, surEtagere, surAmis, surOuvrirAilleurs }: Props) {
  const depot = useDepot();
  const social = useSocial();
  const [navigation, setNavigation] = useState<Navigation>(() => ({
    vue: vueInitiale(livre.id, recettes),
    transition: null,
  }));
  const { vue } = navigation;
  const recette = vue.type === 'recette' ? recettes.find((r) => r.id === vue.id) : undefined;
  const [superpose, setSuperpose] = useState<Superpose | null>(null);
  const fermerSuperpose = useCallback(() => setSuperpose(null), []);
  /** Portions choisies pour la recette affichée (sinon celles de la recette). */
  const [choixPortions, setChoixPortions] = useState<{ id: string; portions: number } | null>(null);
  const portions = recette && choixPortions?.id === recette.id ? choixPortions.portions : (recette?.portions ?? 1);
  const [filtre, setFiltre] = useState<FiltreSommaire>({ texte: '', favoris: false, partout: false });

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
      window.history.pushState({ livre: livre.id, vue: nouvelleVue } satisfies EtatHistorique, '');
      blocAncre.current = 0;
      allerA(nouvelleVue, transition);
    },
    [allerA, livre.id],
  );

  // Ruban, « Annuler » : même effet que le bouton retour
  const retour = () => window.history.back();

  useEffect(() => {
    const surChangementHistorique = (evenement: PopStateEvent) => {
      const etat = (evenement.state ?? {}) as EtatHistorique;
      if (etat.livre !== undefined && etat.livre !== livre.id) return; // un autre livre prend la main
      let cible: Vue = etat.vue ?? { type: 'sommaire' };
      // Une recette supprimée entre-temps n'existe plus : retour au sommaire
      const idCible = cible.type === 'sommaire' ? null : cible.id;
      if (idCible !== null && !refRecettes.current.some((r) => r.id === idCible)) {
        cible = { type: 'sommaire' };
      }
      if (cible.type === 'recette') cible = { ...cible, page: 0 };

      const depart = refVue.current;
      if (ecranDe(cible) === ecranDe(depart)) return; // on a seulement refermé un panneau
      blocAncre.current = 0;
      allerA(cible, depart.type === 'recette' && cible.type === 'sommaire' ? RETOUR_SOMMAIRE : PAGE_PRECEDENTE);
    };
    window.addEventListener('popstate', surChangementHistorique);
    return () => window.removeEventListener('popstate', surChangementHistorique);
  }, [allerA, livre.id]);

  // Arrivée depuis une recherche ou le fil d'activité : on ouvre la recette
  useEffect(() => {
    if (recetteInitiale && recettes.some((r) => r.id === recetteInitiale)) {
      ouvrir({ type: 'recette', id: recetteInitiale, page: 0 }, OUVERTURE_CHAPITRE);
    }
    // (une seule fois, à l'ouverture du livre)
  }, []);

  // ------------------------------------------------------------ Réalisations
  const realisations = useRealisations(recette);

  // ---------------------------------------------------------------- Pagination
  const surImage = useCallback((id: string) => setSuperpose({ type: 'image', id }), []);
  const surAdresse = useCallback((adresse: string) => setSuperpose({ type: 'photo', adresse }), []);
  const blocs = useMemo(
    () =>
      recette
        ? construireBlocsRecette(recette, {
            portions,
            surPortions: (n) => setChoixPortions({ id: recette.id, portions: n }),
            surImage,
            surAdresse,
            surFavori: () => void depot.basculerFavori(recette.id),
            surCuisine: () => setSuperpose({ type: 'cuisine' }),
            surTransmettre: () => setSuperpose({ type: 'transmettre', source: { type: 'recette', recette } }),
            surModifier: () => ouvrir({ type: 'edition', id: recette.id }, PAGE_SUIVANTE),
            realisations,
            uid: social.uid,
            surNouvelleRealisation: () => setSuperpose({ type: 'realisation' }),
          })
        : [],
    [recette, portions, surImage, surAdresse, depot, ouvrir, realisations, social.uid],
  );
  const refMesure = useRef<HTMLDivElement>(null);
  const refCadre = useRef<HTMLElement>(null);
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
      blocs.map((b) => b.debutPage === true),
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
      if (vue.type !== 'recette' || superpose) return;
      if (e.key === 'ArrowRight') tourner(1);
      else if (e.key === 'ArrowLeft') tourner(-1);
      else if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [vue.type, tourner, superpose]);

  // Gestes : swipe horizontal, ou tap sur le bord gauche / droit de la page
  const depart = useRef<{ x: number; y: number; t: number } | null>(null);

  const surAppui = (e: React.PointerEvent) => {
    const surBouton = (e.target as Element).closest('button, a, input, textarea, select, label');
    depart.current = surBouton || superpose ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
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
        // (le filtre écarte un bloc disparu, le temps que la pagination soit recalculée)
        blocs={(pages?.[vue.page] ?? []).map((i) => blocs[i]).filter((b) => b !== undefined)}
        numero={vue.page + 1}
        total={nombrePages}
        surRetourSommaire={retour}
        surPrecedente={() => tourner(-1)}
        surSuivante={() => tourner(1)}
      />
    );
  } else if (vue.type === 'edition') {
    page = (
      <Suspense fallback={<p className="page__attente">…</p>}>
      <FormulaireRecette
        recette={recettes.find((r) => r.id === vue.id) ?? null}
        livreId={livre.id}
        surTermine={retour}
        // Recette supprimée ou déplacée : on saute par-dessus sa page pour revenir au sommaire
        surPartie={() => window.history.go(-2)}
      />
      </Suspense>
    );
  } else {
    page = (
      <Sommaire
        livre={livre}
        recettes={recettes}
        filtre={filtre}
        surFiltre={setFiltre}
        surOuvrirRecette={(id) => ouvrir({ type: 'recette', id, page: 0 }, OUVERTURE_CHAPITRE)}
        surOuvrirAilleurs={surOuvrirAilleurs}
        surNouvelleRecette={() => ouvrir({ type: 'edition', id: null }, PAGE_SUIVANTE)}
        surCompte={() => setSuperpose({ type: 'compte' })}
        surAmis={surAmis}
        surEtagere={surEtagere}
        surTransmettreLivre={() => setSuperpose({ type: 'transmettre', source: { type: 'livre', livre, recettes } })}
        defilementInitial={defilementSommaire.current}
        surDefilement={(position) => (defilementSommaire.current = position)}
      />
    );
  }

  return (
    <main
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
            <PageRecette recette={recette} blocs={blocs} numero={1} total={1} surRetourSommaire={() => {}} refContenu={refMesure} />
          </div>
        </div>
      )}

      <Suspense fallback={null}>
      {superpose?.type === 'image' && <Visionneuse id={superpose.id} surFermer={fermerSuperpose} />}
      {superpose?.type === 'photo' && <Visionneuse adresse={superpose.adresse} surFermer={fermerSuperpose} />}
      {superpose?.type === 'cuisine' && recette && (
        <ModeCuisine recette={recette} portions={portions} surFermer={fermerSuperpose} />
      )}
      {superpose?.type === 'transmettre' && (
        <PanneauTransmettre
          source={superpose.source}
          surFermer={fermerSuperpose}
          surVoirAmis={() => {
            // On referme le panneau (retour), puis on ouvre le cercle des amis
            window.history.back();
            setTimeout(surAmis, 250);
          }}
        />
      )}
      {superpose?.type === 'realisation' && recette && (
        <PanneauRealisation recette={recette} surFermer={fermerSuperpose} surPubliee={realisations.recharger} />
      )}
      {superpose?.type === 'compte' && <PanneauCompte surFermer={fermerSuperpose} />}
      </Suspense>
    </main>
  );
}
