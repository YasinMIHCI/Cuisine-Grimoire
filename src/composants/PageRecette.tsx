import { useEffect } from 'react';
import type { Recette } from '../types';
import { formaterDuree, formaterQuantite } from '../utilitaires/format';
import { Ornement } from './Ornement';

interface Props {
  recette: Recette;
  surRetourSommaire: () => void;
}

/**
 * Affichage d'une recette.
 * Étape (a) : une seule page défilante. La pagination automatique et les
 * pages qui tournent arrivent à l'étape (b).
 */
export function PageRecette({ recette, surRetourSommaire }: Props) {
  // On repart toujours du haut de la page en ouvrant une recette
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [recette.id]);

  return (
    <article className="recette">
      {/* Ruban marque-page : retour au sommaire */}
      <button type="button" className="ruban" onClick={surRetourSommaire}>
        <span>Sommaire</span>
      </button>

      <header className="recette__entete">
        <p className="recette__categorie">{recette.categorie}</p>
        <h1 className="recette__titre">{recette.titre}</h1>
        <Ornement />
        <dl className="recette__infos">
          <div>
            <dt>Préparation</dt>
            <dd>{formaterDuree(recette.tempsPreparation)}</dd>
          </div>
          <div>
            <dt>Cuisson</dt>
            <dd>{formaterDuree(recette.tempsCuisson)}</dd>
          </div>
          <div>
            <dt>Portions</dt>
            <dd>{recette.portions}</dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="recette__section">Ingrédients</h2>
        <ul className="ingredients">
          {recette.ingredients.map((ingredient, i) => (
            <li key={i}>
              {ingredient.quantite !== null && (
                <strong>
                  {formaterQuantite(ingredient.quantite)}
                  {ingredient.unite && ` ${ingredient.unite}`}{' '}
                </strong>
              )}
              {ingredient.nom}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="recette__section">Préparation</h2>
        <ol className="etapes">
          {recette.etapes.map((etape, i) => (
            // La première étape reçoit une lettrine enluminée (voir CSS)
            <li key={i} className={i === 0 ? 'etape etape--lettrine' : 'etape'}>
              <span className="etape__numero">{i + 1}</span>
              <p>{etape.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      {recette.notes && (
        <section className="notes">
          <h2 className="recette__section">Notes</h2>
          <p>{recette.notes}</p>
        </section>
      )}
    </article>
  );
}
