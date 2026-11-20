import type { Livre } from '../types';
import type { Resultat } from '../utilitaires/recherche';
import { Symbole } from './Symbole';

interface Props {
  resultats: Resultat[];
  livres: Livre[];
  surOuvrir: (livreId: string, recetteId: string) => void;
}

/** Résultats d'une recherche dans toute la bibliothèque, regroupés par livre. */
export function ResultatsRecherche({ resultats, livres, surOuvrir }: Props) {
  if (resultats.length === 0) return <p className="sommaire__vide">Aucune recette ne correspond.</p>;
  return (
    <div className="resultats">
      {livres.map((livre) => {
        const duLivre = resultats.filter((r) => r.recette.livreId === livre.id);
        if (duLivre.length === 0) return null;
        return (
          <section key={livre.id} className="categorie">
            <h2 className="categorie__titre">{livre.titre}</h2>
            <ul className="chapitres">
              {duLivre.map(({ recette, ingredients }) => (
                <li key={recette.id}>
                  <button type="button" className="chapitre" onClick={() => surOuvrir(livre.id, recette.id)}>
                    <span className="chapitre__vignette">
                      <Symbole nom={recette.symbole} taille={22} />
                    </span>
                    <span className="chapitre__titre">
                      {recette.titre}
                      {recette.favori && <span className="chapitre__favori"> ✦</span>}
                      {ingredients.length > 0 && <small className="chapitre__indice">avec {ingredients.join(', ')}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Barre de recherche : texte, filtre « favoris » et, au choix, portée « tout ». */
export function BarreRecherche({
  texte,
  favoris,
  partout,
  surTexte,
  surFavoris,
  surPartout,
}: {
  texte: string;
  favoris: boolean;
  /** undefined : pas de choix de portée (recherche toujours dans toute la bibliothèque). */
  partout?: boolean;
  surTexte: (texte: string) => void;
  surFavoris: (favoris: boolean) => void;
  surPartout?: (partout: boolean) => void;
}) {
  return (
    <div className="recherche">
      <label className="recherche__champ">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5" />
        </svg>
        <input
          type="search"
          placeholder="Titre ou ingrédient…"
          aria-label="Chercher une recette par titre ou ingrédient"
          value={texte}
          onChange={(e) => surTexte(e.target.value)}
        />
      </label>
      <div className="recherche__filtres">
        <button type="button" className="filtre" aria-pressed={favoris} onClick={() => surFavoris(!favoris)}>
          ✦ Favoris
        </button>
        {partout !== undefined && surPartout && (
          <>
            <button type="button" className="filtre" aria-pressed={!partout} onClick={() => surPartout(false)}>
              Ce livre
            </button>
            <button type="button" className="filtre" aria-pressed={partout} onClick={() => surPartout(true)}>
              Toute la bibliothèque
            </button>
          </>
        )}
      </div>
    </div>
  );
}
