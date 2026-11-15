import { useLayoutEffect, useRef } from 'react';
import { CATEGORIES, type Livre, type Recette } from '../types';
import { ImageCollee } from './ImageCollee';
import { enChiffresRomains, formaterDuree } from '../utilitaires/format';
import { Ornement } from './Ornement';
import { Symbole } from './Symbole';

interface Props {
  livre: Livre;
  recettes: Recette[];
  surOuvrirRecette: (id: string) => void;
  surNouvelleRecette: () => void;
  surCompte: () => void;
  surEtagere: () => void;
  /** Position de défilement à restaurer (on revient là où on était). */
  defilementInitial?: number;
  surDefilement?: (position: number) => void;
}

/**
 * Sommaire d'un livre : les recettes sont les chapitres du grimoire,
 * regroupées par catégorie et numérotées en continu (chiffres romains).
 */
export function Sommaire({
  livre,
  recettes,
  surOuvrirRecette,
  surNouvelleRecette,
  surCompte,
  surEtagere,
  defilementInitial = 0,
  surDefilement,
}: Props) {
  const refPage = useRef<HTMLDivElement>(null);

  // Au retour d'une recette, on retrouve le sommaire à l'endroit où on l'avait laissé
  useLayoutEffect(() => {
    if (refPage.current) refPage.current.scrollTop = defilementInitial;
    // (uniquement à l'ouverture de la page)
  }, []);

  // Numéro de chapitre continu d'une catégorie à l'autre
  let numero = 0;

  return (
    <div
      className="page page--defilante sommaire"
      ref={refPage}
      onScroll={(e) => surDefilement?.(e.currentTarget.scrollTop)}
    >
      {/* Retour à l'étagère (tous les livres) */}
      <button type="button" className="bouton-etagere" onClick={surEtagere} aria-label="Retour à l’étagère">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 4v15M9 4v15M5 4h4M5 19h4M13 5l4-1 3 14-4 1zM3 21h18" />
        </svg>
      </button>

      {/* Accès au compte (synchronisation, déconnexion) */}
      <button type="button" className="bouton-compte" onClick={surCompte} aria-label="Compte">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
        </svg>
      </button>

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
                        {recette.photoPrincipale ? (
                          <ImageCollee id={recette.photoPrincipale} format="vignette" />
                        ) : (
                          <Symbole nom={recette.symbole} taille={22} />
                        )}
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

      {recettes.length === 0 && (
        <p className="sommaire__vide">Ce grimoire est encore vierge. Écrivez-y votre première recette !</p>
      )}

      <footer className="sommaire__pied">
        <button type="button" className="bouton bouton--principal" onClick={surNouvelleRecette}>
          + Nouvelle recette
        </button>
        <Ornement />
      </footer>
    </div>
  );
}
