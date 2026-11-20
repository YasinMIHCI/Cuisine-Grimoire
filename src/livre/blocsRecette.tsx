import type { ReactNode } from 'react';
import type { Recette } from '../types';
import { formaterDuree, formaterQuantite } from '../utilitaires/format';
import { ajusterQuantite } from '../utilitaires/texte';
import { ImageCollee } from '../composants/ImageCollee';
import { Ornement } from '../composants/Ornement';
import { CarteRealisation, type EtatRealisations } from '../amis/realisations';

/**
 * Un bloc est un morceau insécable de recette (en-tête, un ingrédient,
 * une étape…). La pagination mesure chaque bloc puis les répartit sur les pages.
 */
export interface Bloc {
  cle: string;
  /** Vrai pour un titre de section : il ne doit pas rester seul en bas de page. */
  lieAuSuivant?: boolean;
  /** Vrai pour un bloc qui commence toujours une nouvelle page. */
  debutPage?: boolean;
  noeud: ReactNode;
}

export interface OptionsBlocs {
  /** Nombre de portions affiché (les quantités sont recalculées). */
  portions: number;
  surPortions: (portions: number) => void;
  /** Agrandir une image de la bibliothèque, ou une photo par son adresse. */
  surImage: (id: string) => void;
  surAdresse: (adresse: string) => void;
  surFavori: () => void;
  surCuisine: () => void;
  surTransmettre: () => void;
  surModifier: () => void;
  realisations: EtatRealisations;
  uid: string;
  surNouvelleRealisation: () => void;
}

/** Petite icône SVG pour les boutons d'action de la recette. */
function Icone({ trace }: { trace: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={trace} />
    </svg>
  );
}

const ICONES = {
  favori: 'M6 3h12v18l-6-5-6 5z',
  cuisine: 'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z',
  transmettre: 'M4 12l16-8-6 16-3-7zM11 13l9-9',
  modifier: 'M4 20c2-8 7-14 16-16-1 8-6 13-13 14zM4 20l6-7',
};

/** Découpe une recette en blocs, dans l'ordre de lecture. */
export function construireBlocsRecette(recette: Recette, options: OptionsBlocs): Bloc[] {
  const blocs: Bloc[] = [];
  const { portions } = options;
  const facteur = portions / recette.portions;
  const { surImage } = options;

  blocs.push({
    cle: 'entete',
    noeud: (
      <header className="recette__entete">
        <h1 className="recette__titre">{recette.titre}</h1>
        {recette.transmisPar && <p className="recette__transmis">transmise par {recette.transmisPar}</p>}
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
            <dd className="portions">
              <button
                type="button"
                className="portions__bouton"
                onClick={() => options.surPortions(Math.max(1, portions - 1))}
                disabled={portions <= 1}
                aria-label="Une portion de moins"
              >
                −
              </button>
              <span className={portions !== recette.portions ? 'portions__nombre portions__nombre--ajuste' : 'portions__nombre'}>
                {portions}
              </span>
              <button
                type="button"
                className="portions__bouton"
                onClick={() => options.surPortions(Math.min(99, portions + 1))}
                aria-label="Une portion de plus"
              >
                +
              </button>
            </dd>
          </div>
        </dl>
        {/* Actions de la recette */}
        <div className="recette__actions">
          <button
            type="button"
            className={recette.favori ? 'action action--active' : 'action'}
            onClick={options.surFavori}
            aria-pressed={recette.favori}
          >
            <Icone trace={ICONES.favori} />
            <span>Favori</span>
          </button>
          <button type="button" className="action" onClick={options.surCuisine}>
            <Icone trace={ICONES.cuisine} />
            <span>Cuisiner</span>
          </button>
          <button type="button" className="action" onClick={options.surTransmettre}>
            <Icone trace={ICONES.transmettre} />
            <span>Transmettre</span>
          </button>
          <button type="button" className="action" onClick={options.surModifier}>
            <Icone trace={ICONES.modifier} />
            <span>Modifier</span>
          </button>
        </div>
      </header>
    ),
  });

  if (recette.photoPrincipale) {
    const id = recette.photoPrincipale;
    blocs.push({
      cle: 'photo-principale',
      noeud: <ImageCollee id={id} format="principale" surClic={() => surImage(id)} alt={recette.titre} />,
    });
  }

  blocs.push({
    cle: 'titre-ingredients',
    lieAuSuivant: true,
    noeud: (
      <h2 className="recette__section">
        Ingrédients
        {facteur !== 1 && <small className="recette__ajuste"> pour {portions} portion{portions > 1 ? 's' : ''}</small>}
      </h2>
    ),
  });
  recette.ingredients.forEach((ingredient, i) => {
    blocs.push({
      cle: `ingredient-${i}`,
      noeud: (
        <p className="ingredient">
          {ingredient.quantite !== null && (
            <strong>
              {formaterQuantite(ajusterQuantite(ingredient.quantite, facteur, ingredient.unite))}
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
    if (etape.image) {
      const id = etape.image;
      blocs.push({
        cle: `image-etape-${i}`,
        noeud: <ImageCollee id={id} format="etape" surClic={() => surImage(id)} alt={`Étape ${i + 1}`} />,
      });
    }
  });

  if (recette.notes) {
    blocs.push({
      cle: 'titre-notes',
      lieAuSuivant: true,
      noeud: <h2 className="recette__section">Notes</h2>,
    });
    blocs.push({ cle: 'notes', noeud: <p className="notes">{recette.notes}</p> });
  }

  // Galerie : deux photos par rangée, chaque rangée est un bloc
  if (recette.galerie.length > 0) {
    blocs.push({
      cle: 'titre-galerie',
      lieAuSuivant: true,
      noeud: <h2 className="recette__section">Galerie</h2>,
    });
    for (let i = 0; i < recette.galerie.length; i += 2) {
      blocs.push({
        cle: `galerie-${i}`,
        noeud: (
          <div className="galerie-rangee">
            {recette.galerie.slice(i, i + 2).map((id) => (
              <ImageCollee key={id} id={id} format="galerie" surClic={() => surImage(id)} />
            ))}
          </div>
        ),
      });
    }
  }

  // Page « Réalisations » : les photos de plats, les siennes et celles des amis
  const { realisations } = options;
  if (realisations.visible) {
    blocs.push({
      cle: 'titre-realisations',
      debutPage: true,
      lieAuSuivant: true,
      noeud: (
        <header className="realisations__entete">
          <h2 className="recette__titre">Réalisations</h2>
          <Ornement />
          <p className="message">
            {realisations.indisponible
              ? 'Connexion nécessaire pour voir les photos de vos amis.'
              : realisations.liste.length === 0
                ? 'Aucune photo pour l’instant. Montrez votre plat à vos amis qui ont cette recette !'
                : 'Les plats réalisés par vous et vos amis qui ont cette recette.'}
          </p>
        </header>
      ),
    });
    for (const r of realisations.liste) {
      blocs.push({
        cle: `realisation-${r.id}`,
        noeud: (
          <CarteRealisation
            realisation={r}
            estAuteur={r.auteurId === options.uid}
            surAgrandir={options.surAdresse}
            surSupprimee={realisations.recharger}
          />
        ),
      });
    }
    blocs.push({
      cle: 'ajout-realisation',
      noeud: (
        <button type="button" className="bouton bouton--principal" onClick={options.surNouvelleRealisation}>
          + Ajouter ma réalisation
        </button>
      ),
    });
  }

  return blocs;
}
