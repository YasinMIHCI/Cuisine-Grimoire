import { CATEGORIES, type Livre, type Recette } from '../types';
import { enChiffresRomains, formaterDuree } from '../utilitaires/format';
import { Ornement } from './Ornement';
import { Symbole } from './Symbole';

interface Props {
  livre: Livre;
  recettes: Recette[];
  surOuvrirRecette: (id: string) => void;
}

/**
 * Sommaire d'un livre : les recettes sont les chapitres du grimoire,
 * regroupées par catégorie et numérotées en continu (chiffres romains).
 */
export function Sommaire({ livre, recettes, surOuvrirRecette }: Props) {
  // Numéro de chapitre continu d'une catégorie à l'autre
  let numero = 0;

  return (
    <div className="sommaire">
      <header className="frontispice">
        <div className="frontispice__symbole">
          <Symbole nom={livre.symbole} taille={44} />
        </div>
        <h1 className="frontispice__titre">{livre.titre}</h1>
        <p className="frontispice__sous-titre">Table des chapitres</p>
        <Ornement />
      </header>

      {CATEGORIES.map((categorie) => {
        const chapitres = recettes.filter((r) => r.categorie === categorie);
        if (chapitres.length === 0) return null;
        return (
          <section key={categorie} className="categorie">
            <h2 className="categorie__titre">{categorie}</h2>
            <ol className="chapitres">
              {chapitres.map((recette) => {
                numero += 1;
                return (
                  <li key={recette.id}>
                    <button
                      type="button"
                      className="chapitre"
                      onClick={() => surOuvrirRecette(recette.id)}
                    >
                      <span className="chapitre__vignette">
                        <Symbole nom={recette.symbole} taille={22} />
                      </span>
                      <span className="chapitre__numero">{enChiffresRomains(numero)}.</span>
                      <span className="chapitre__titre">
                        {recette.titre}
                        {recette.favori && (
                          <span className="chapitre__favori" title="Favori" aria-label="Favori">
                            {' '}
                            ✦
                          </span>
                        )}
                      </span>
                      {/* Points de conduite, comme dans une vraie table des matières */}
                      <span className="chapitre__points" aria-hidden="true" />
                      <span className="chapitre__duree">
                        {formaterDuree(recette.tempsPreparation + recette.tempsCuisson)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <footer className="sommaire__pied">
        <Ornement />
      </footer>
    </div>
  );
}
