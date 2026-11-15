import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';

/** Description d'une animation de pages tournées. */
export interface Transition {
  /** « avant » : on avance dans le livre ; « arriere » : on revient en arrière. */
  sens: 'avant' | 'arriere';
  /** Nombre de pages intermédiaires qui défilent (0 = une seule page tournée). */
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
 * Des feuilles « intercalaires » peuvent défiler entre les deux.
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
    const { sens, duree, decalage } = sortante.transition;
    const terminer = () => {
      setSortante(null);
      refSurFin.current?.();
    };

    const contexte = gsap.context(() => {
      // Mouvement réduit : simple fondu de l'ancienne page vers la nouvelle
      if (mouvementReduit()) {
        gsap.to('[data-role="sortante"]', { opacity: 0, duration: 0.3, onComplete: terminer });
        return;
      }

      const feuilles = gsap.utils
        .toArray<HTMLElement>('[data-ordre]')
        .sort((a, b) => Number(a.dataset.ordre) - Number(b.dataset.ordre));
      const chronologie = gsap.timeline({ onComplete: terminer });
      const courbe = feuilles.length > 1 ? 'power1.inOut' : 'power2.inOut';

      if (sens === 'avant') {
        feuilles.forEach((feuille, i) => {
          const debut = i * decalage;
          const ombre = feuille.querySelector('.feuille__ombre');
          chronologie.fromTo(
            feuille,
            { rotationY: 0 },
            { rotationY: -180, duration: duree, ease: courbe, force3D: true },
            debut,
          );
          if (ombre) chronologie.to(ombre, { opacity: 1, duration: duree * 0.5 }, debut);
          // La feuille s'efface en fin de course (elle sort du livre)
          chronologie.to(feuille, { opacity: 0, duration: duree * 0.25 }, debut + duree * 0.75);
        });
      } else {
        // Les feuilles attendent, retournées et invisibles, côté gauche
        gsap.set(feuilles, { rotationY: -180, opacity: 0 });
        feuilles.forEach((feuille, i) => {
          const debut = i * decalage;
          const ombre = feuille.querySelector('.feuille__ombre');
          chronologie.to(feuille, { opacity: 1, duration: duree * 0.25 }, debut);
          chronologie.to(
            feuille,
            { rotationY: 0, duration: duree, ease: courbe, force3D: true },
            debut,
          );
          if (ombre) {
            chronologie.fromTo(ombre, { opacity: 1 }, { opacity: 0, duration: duree * 0.5 }, debut + duree * 0.5);
          }
        });
      }
    }, refLivre);

    // Fin ou interruption : GSAP retire tous les styles qu'il a posés
    return () => contexte.revert();
  }, [sortante]);

  // --- Empilement des feuilles -------------------------------------------
  const reduit = sortante !== null && mouvementReduit();
  const sens = sortante && !reduit ? sortante.transition.sens : 'avant';
  const n = sortante && !reduit ? sortante.transition.intercalaires : 0;
  const enAvant = sens === 'avant';

  return (
    <div className="livre" ref={refLivre}>
      {/* Page d'arrivée : dessous si on avance, dessus (et en mouvement) si on recule */}
      <Feuille
        key={cle}
        role="entrante"
        niveau={sortante && !enAvant ? n + 1 : 0}
        ordre={sortante && !enAvant ? n : undefined}
      >
        {children}
      </Feuille>

      {sortante &&
        Array.from({ length: n }, (_, k) => (
          <Feuille
            key={`intercalaire-${k}`}
            role="intercalaire"
            niveau={enAvant ? n - k : k + 1}
            ordre={enAvant ? k + 1 : k}
          >
            <div className="intercalaire" />
          </Feuille>
        ))}

      {/* Page de départ : dessus (et en mouvement) si on avance, dessous si on recule */}
      {sortante && (
        <Feuille
          key={sortante.cle}
          role="sortante"
          niveau={enAvant ? n + 1 : 0}
          ordre={enAvant && !reduit ? 0 : undefined}
          inerte
        >
          {sortante.noeud}
        </Feuille>
      )}
    </div>
  );
}

interface PropsFeuille {
  role: 'entrante' | 'sortante' | 'intercalaire';
  /** Position dans la pile (z-index). */
  niveau: number;
  /** Rang de départ dans l'animation ; absent si la feuille reste immobile. */
  ordre?: number;
  /** Vrai pour une page qui n'est plus interactive. */
  inerte?: boolean;
  children: ReactNode;
}

/** Une feuille du livre : recto (contenu) et, pendant qu'elle tourne, verso vierge. */
function Feuille({ role, niveau, ordre, inerte, children }: PropsFeuille) {
  const tourne = ordre !== undefined;
  return (
    <div
      className={tourne ? 'feuille feuille--tournante' : 'feuille'}
      style={{ zIndex: niveau }}
      data-role={role}
      data-ordre={ordre}
      inert={inerte || role === 'intercalaire'}
    >
      <div className="feuille__recto parchemin">
        {children}
        {tourne && <div className="feuille__ombre" />}
      </div>
      {tourne && <div className="feuille__verso parchemin" />}
    </div>
  );
}
