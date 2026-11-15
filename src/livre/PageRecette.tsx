import type { Ref } from 'react';
import type { Recette } from '../types';
import type { Bloc } from './blocsRecette';

interface Props {
  recette: Recette;
  /** Les blocs à afficher sur cette page. */
  blocs: Bloc[];
  /** Numéro de la page (à partir de 1) et nombre total de pages. */
  numero: number;
  total: number;
  surRetourSommaire: () => void;
  surModifier: () => void;
  /** Référence vers la zone de contenu (utilisée par la page de mesure). */
  refContenu?: Ref<HTMLDivElement>;
}

/**
 * Une page de recette : titre courant, contenu (blocs), folio en pied de page,
 * ruban marque-page pour revenir au sommaire et plume pour modifier la recette.
 */
export function PageRecette({ recette, blocs, numero, total, surRetourSommaire, surModifier, refContenu }: Props) {
  return (
    <article className="page page--recette">
      <button
        type="button"
        className="ruban"
        onClick={surRetourSommaire}
        aria-label="Retour au sommaire"
      >
        <span>Sommaire</span>
      </button>

      {/* Plume : ouvre le formulaire de modification */}
      <button type="button" className="bouton-plume" onClick={surModifier} aria-label="Modifier la recette">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20c2-8 7-14 16-16-1 8-6 13-13 14zM4 20l6-7" />
        </svg>
      </button>

      {/* Titre courant : la catégorie en première page, le titre de la recette ensuite */}
      <p className="page__titre-courant">{numero === 1 ? recette.categorie : recette.titre}</p>

      <div className="page__contenu" ref={refContenu}>
        {blocs.map((bloc) => (
          <div key={bloc.cle} className="bloc">
            {bloc.noeud}
          </div>
        ))}
      </div>

      <footer className="page__pied" aria-label={`Page ${numero} sur ${total}`}>
        <span className="page__fleche" aria-hidden="true">{numero > 1 ? '‹' : ''}</span>
        <span className="page__folio" aria-hidden="true">
          {total > 1 ? `${numero} / ${total}` : ''}
        </span>
        <span className="page__fleche" aria-hidden="true">{numero < total ? '›' : ''}</span>
      </footer>
    </article>
  );
}
