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
  /** Référence vers la zone de contenu (utilisée par la page de mesure). */
  refContenu?: Ref<HTMLDivElement>;
}

/**
 * Une page de recette : titre courant, contenu (blocs), folio en pied de page
 * et ruban marque-page pour revenir au sommaire.
 */
export function PageRecette({ recette, blocs, numero, total, surRetourSommaire, refContenu }: Props) {
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
