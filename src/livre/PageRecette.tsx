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
  /** Tourner la page (absents sur la page de mesure). */
  surPrecedente?: () => void;
  surSuivante?: () => void;
  /** Référence vers la zone de contenu (utilisée par la page de mesure). */
  refContenu?: Ref<HTMLDivElement>;
}

/**
 * Une page de recette : titre courant, contenu (blocs), folio en pied de page,
 * ruban marque-page pour revenir au sommaire, marque-page doré si favorite.
 */
export function PageRecette({ recette, blocs, numero, total, surRetourSommaire, surPrecedente, surSuivante, refContenu }: Props) {
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

      {/* Marque-page doré des recettes favorites */}
      {recette.favori && <span className="marque-page" role="img" aria-label="Recette favorite" />}

      {/* Titre courant : la catégorie en première page, le titre de la recette ensuite */}
      <p className="page__titre-courant">{numero === 1 ? recette.categorie : recette.titre}</p>

      <div className="page__contenu" ref={refContenu}>
        {blocs.map((bloc) => (
          <div key={bloc.cle} className="bloc">
            {bloc.noeud}
          </div>
        ))}
      </div>

      <footer className="page__pied">
        <button
          type="button"
          className="page__fleche"
          onClick={surPrecedente}
          disabled={numero <= 1 || !surPrecedente}
          aria-label="Page précédente"
        >
          ‹
        </button>
        <span className="page__folio">
          {total > 1 && (
            <>
              <span aria-hidden="true">{`${numero} / ${total}`}</span>
              <span className="lecteur-seulement">{`Page ${numero} sur ${total}`}</span>
            </>
          )}
        </span>
        <button
          type="button"
          className="page__fleche"
          onClick={surSuivante}
          disabled={numero >= total || !surSuivante}
          aria-label="Page suivante"
        >
          ›
        </button>
      </footer>
    </article>
  );
}
