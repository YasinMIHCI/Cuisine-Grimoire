import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';

/** Description d'une animation de pages tournées. */
export interface Transition {
  /** « avant » : on avance dans le livre ; « arriere » : on revient en arrière. */
  sens: 'avant' | 'arriere';
  /**
   * Nombre de pages intermédiaires qui défilent (0 = une seule page tournée).
   * Peut être grand : quelques feuilles seulement existent à l'écran et sont
   * réutilisées en boucle, ce qui donne un défilement « sans fin ».
   */
  intercalaires: number;
  /** Durée du mouvement d'une feuille (s). */
  duree: number;
  /** Écart entre le départ de deux feuilles successives (s). */
  decalage: number;
}

interface Props {
  /** Identifiant de la page affichée : quand il change, la page change. */
  cle: string;
  /** Animation à jouer lors du changement (null = changement immédiat). */
  transition: Transition | null;
  /** Appelé quand l'animation est terminée. */
  surFin?: () => void;
  children: ReactNode;
}

interface PageSortante {
  cle: string;
  noeud: ReactNode;
  transition: Transition;
}

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Affiche une page de parchemin et anime le passage d'une page à l'autre.
 *
 * Chaque feuille pivote autour de la reliure (bord gauche) en CSS 3D ; GSAP ne
 * pilote que `transform` et `opacity`, pour rester fluide sur téléphone.
 * - en avant : la page quittée se soulève et découvre la nouvelle, dessous ;
 * - en arrière : la nouvelle page revient se poser sur l'ancienne.
 * Entre les deux, des feuilles intermédiaires peuvent défiler à toute vitesse.
 */
export function TourneurDePages({ cle, transition, surFin, children }: Props) {
  const refLivre = useRef<HTMLDivElement>(null);
  // Dernier contenu affiché : il devient la page « sortante » au changement de clé
  const dernier = useRef({ cle, noeud: children });
  const [cleCourante, setCleCourante] = useState(cle);
  const [sortante, setSortante] = useState<PageSortante | null>(null);
  const refSurFin = useRef(surFin);
  refSurFin.current = surFin;

  // Changement de page détecté pendant le rendu : on garde l'ancienne page le
  // temps de l'animation (motif React « état dérivé des props »).
  if (cleCourante !== cle) {
    setCleCourante(cle);
    setSortante(
      transition ? { cle: dernier.current.cle, noeud: dernier.current.noeud, transition } : null,
    );
  }

  useLayoutEffect(() => {
    dernier.current = { cle, noeud: children };
  });

  useLayoutEffect(() => {
    if (!sortante) return;
    const { sens, duree, decalage, intercalaires } = sortante.transition;
    const terminer = () => {
      setSortante(null);
      refSurFin.current?.();
    };

    let image1 = 0;
    let image2 = 0;

    const contexte = gsap.context(() => {
      // Mouvement réduit : simple fondu de l'ancienne page vers la nouvelle
      if (mouvementReduit()) {
        gsap.to('[data-role="sortante"]', { opacity: 0, duration: 0.3, onComplete: terminer });
        return;
      }

      const un = (role: string) => refLivre.current!.querySelector<HTMLElement>(`[data-role="${role}"]`)!;
      const reserve = gsap.utils.toArray<HTMLElement>('[data-role="reserve"]');
      // La chronologie est créée en pause : elle démarre deux images plus tard,
      // une fois les nouvelles feuilles dessinées par le navigateur. Sans cela,
      // le temps de préparation des pages « mange » le début de l'animation.
      const chronologie = gsap.timeline({ paused: true, onComplete: terminer });
      const courbe = intercalaires > 0 ? 'sine.inOut' : 'power2.inOut';

      if (sens === 'avant') {
        // Ordre de passage : la page quittée, les feuilles de la réserve (en
        // boucle), puis la feuille de fond qui découvre la page d'arrivée.
        const passages = [un('sortante')];
        for (let k = 0; k < intercalaires - 1; k++) passages.push(reserve[k % reserve.length]);
        if (intercalaires > 0) passages.push(un('fond'));

        passages.forEach((feuille, k) => {
          const debut = k * decalage;
          // Chaque feuille part de dessous celles qui volent déjà
          chronologie.set(feuille, { rotationY: 0, opacity: 1, zIndex: 1000 - k }, debut);
          chronologie.to(feuille, { rotationY: -180, duration: duree, ease: courbe, force3D: true }, debut);
          // …et s'efface en fin de course (elle sort du livre)
          chronologie.to(feuille, { opacity: 0, duration: duree * 0.25 }, debut + duree * 0.75);
        });
      } else {
        // En arrière : les feuilles reviennent de la gauche et se posent les
        // unes sur les autres ; la page d'arrivée se pose en dernier.
        const passages: HTMLElement[] = [];
        for (let k = 0; k < intercalaires; k++) passages.push(reserve[k % reserve.length]);
        passages.push(un('entrante'));
        gsap.set(passages, { rotationY: -180, opacity: 0 });

        passages.forEach((feuille, k) => {
          const debut = k * decalage;
          chronologie.set(feuille, { rotationY: -180, opacity: 0, zIndex: 10 + k }, debut);
          chronologie.to(feuille, { opacity: 1, duration: duree * 0.25 }, debut);
          chronologie.to(feuille, { rotationY: 0, duration: duree, ease: courbe, force3D: true }, debut);
        });
      }

      image1 = requestAnimationFrame(() => {
        image2 = requestAnimationFrame(() => chronologie.play());
      });
    }, refLivre);

    // Fin ou interruption : GSAP retire tous les styles qu'il a posés
    return () => {
      cancelAnimationFrame(image1);
      cancelAnimationFrame(image2);
      contexte.revert();
    };
  }, [sortante]);

  // --- Empilement des feuilles -------------------------------------------
  const reduit = sortante !== null && mouvementReduit();
  const anime = sortante !== null && !reduit;
  const enAvant = !anime || sortante.transition.sens === 'avant';
  const n = anime ? sortante.transition.intercalaires : 0;
  // Taille de la réserve : assez de feuilles pour celles qui volent en même temps
  const tailleReserve = anime
    ? Math.min(
        enAvant ? Math.max(n - 1, 0) : n,
        Math.ceil(sortante.transition.duree / Math.max(sortante.transition.decalage, 0.01)) + 1,
      )
    : 0;

  return (
    <div className="livre" ref={refLivre}>
      {/* Page d'arrivée : dessous si on avance, dessus (et en mouvement) si on recule */}
      <Feuille key={cle} role="entrante" niveau={enAvant ? 0 : 3} tourne={anime && !enAvant}>
        {children}
      </Feuille>

      {/* Feuille de fond : cache la page d'arrivée pendant le défilement */}
      {anime && enAvant && n > 0 && <Feuille key="fond" role="fond" niveau={1} tourne variante={0} />}

      {/* Réserve de feuilles réutilisées en boucle */}
      {Array.from({ length: tailleReserve }, (_, k) => (
        <Feuille key={`reserve-${k}`} role="reserve" niveau={2} tourne variante={(k % 3) + 1} />
      ))}

      {/* Page de départ : dessus (et en mouvement) si on avance, dessous si on recule */}
      {sortante && (
        <Feuille key={sortante.cle} role="sortante" niveau={enAvant ? 3 : 0} tourne={anime && enAvant} inerte>
          {sortante.noeud}
        </Feuille>
      )}
    </div>
  );
}

interface PropsFeuille {
  role: 'entrante' | 'sortante' | 'fond' | 'reserve';
  /** Position de départ dans la pile (z-index). */
  niveau: number;
  /** Vrai si la feuille pivote pendant l'animation. */
  tourne?: boolean;
  /** Vrai pour une page qui n'est plus interactive. */
  inerte?: boolean;
  /** Motif d'écriture d'une feuille intermédiaire (pour varier les pages). */
  variante?: number;
  children?: ReactNode;
}

/**
 * Une feuille du livre.
 * Pour rester fluide sur téléphone, on limite le nombre de calques graphiques :
 * - une page de contenu a un recto et, pendant qu'elle tourne, un verso vierge ;
 * - une feuille intermédiaire est un seul calque, visible des deux côtés.
 */
function Feuille({ role, niveau, tourne, inerte, variante, children }: PropsFeuille) {
  if (role === 'fond' || role === 'reserve') {
    return (
      <div
        className="feuille feuille--tournante feuille--intercalaire parchemin-simple"
        style={{ zIndex: niveau }}
        data-role={role}
        aria-hidden="true"
      >
        <div className={`intercalaire intercalaire--${variante}`} />
      </div>
    );
  }

  return (
    <div
      className={tourne ? 'feuille feuille--tournante' : 'feuille'}
      style={{ zIndex: niveau }}
      data-role={role}
      inert={inerte}
    >
      <div className="feuille__recto parchemin">{children}</div>
      {tourne && <div className="feuille__verso parchemin-simple" />}
    </div>
  );
}
