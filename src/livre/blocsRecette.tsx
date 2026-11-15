import type { ReactNode } from 'react';
import type { Recette } from '../types';
import { formaterDuree, formaterQuantite } from '../utilitaires/format';
import { Ornement } from '../composants/Ornement';

/**
 * Un bloc est un morceau insécable de recette (en-tête, un ingrédient,
 * une étape…). La pagination mesure chaque bloc puis les répartit sur les pages.
 */
export interface Bloc {
  cle: string;
  /** Vrai pour un titre de section : il ne doit pas rester seul en bas de page. */
  lieAuSuivant?: boolean;
  noeud: ReactNode;
}

/** Découpe une recette en blocs, dans l'ordre de lecture. */
export function construireBlocsRecette(recette: Recette): Bloc[] {
  const blocs: Bloc[] = [];

  blocs.push({
    cle: 'entete',
    noeud: (
      <header className="recette__entete">
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
    ),
  });

  blocs.push({
    cle: 'titre-ingredients',
    lieAuSuivant: true,
    noeud: <h2 className="recette__section">Ingrédients</h2>,
  });
  recette.ingredients.forEach((ingredient, i) => {
    blocs.push({
      cle: `ingredient-${i}`,
      noeud: (
        <p className="ingredient">
          {ingredient.quantite !== null && (
            <strong>
              {formaterQuantite(ingredient.quantite)}
              {ingredient.unite && ` ${ingredient.unite}`}{' '}
            </strong>
          )}
          {ingredient.nom}
        </p>
      ),
    });
  });

  blocs.push({
    cle: 'titre-etapes',
    lieAuSuivant: true,
    noeud: <h2 className="recette__section">Préparation</h2>,
  });
  recette.etapes.forEach((etape, i) => {
    blocs.push({
      cle: `etape-${i}`,
      noeud: (
        // La première étape reçoit une lettrine enluminée (voir CSS)
        <div className={i === 0 ? 'etape etape--lettrine' : 'etape'}>
          <span className="etape__numero">{i + 1}</span>
          <p>{etape.texte}</p>
        </div>
      ),
    });
  });

  if (recette.notes) {
    blocs.push({
      cle: 'titre-notes',
      lieAuSuivant: true,
      noeud: <h2 className="recette__section">Notes</h2>,
    });
    blocs.push({ cle: 'notes', noeud: <p className="notes">{recette.notes}</p> });
  }

  return blocs;
}
