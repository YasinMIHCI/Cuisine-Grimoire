import { useLayoutEffect, useMemo, useRef } from 'react';
import { CATEGORIES, type Livre, type Recette } from '../types';
import { enChiffresRomains, formaterDuree } from '../utilitaires/format';
import { rechercher } from '../utilitaires/recherche';
import { useEtatDepot } from '../donnees/contexte';
import { useSocial } from '../amis/contexte';
import { IconeCourrier, Pastille } from '../amis/Pastille';
import { ImageCollee } from './ImageCollee';
import { Ornement } from './Ornement';
import { BarreRecherche, ResultatsRecherche } from './ResultatsRecherche';
import { Symbole } from './Symbole';

/** Recherche en cours dans le sommaire. */
export interface FiltreSommaire {
  texte: string;
  favoris: boolean;
  /** Vrai : chercher dans toute la bibliothèque, pas seulement ce livre. */
  partout: boolean;
}

interface Props {
  livre: Livre;
  recettes: Recette[];
  filtre: FiltreSommaire;
  surFiltre: (filtre: FiltreSommaire) => void;
  surOuvrirRecette: (id: string) => void;
  surOuvrirAilleurs: (livreId: string, recetteId: string) => void;
  surNouvelleRecette: () => void;
  surCompte: () => void;
  surAmis: () => void;
  surEtagere: () => void;
  surTransmettreLivre: () => void;
  /** Position de défilement à restaurer (on revient là où on était). */
  defilementInitial?: number;
  surDefilement?: (position: number) => void;
}

/**
 * Sommaire d'un livre : les recettes sont les chapitres du grimoire,
 * regroupées par catégorie et numérotées en continu (chiffres romains).
 * Une barre de recherche filtre les chapitres (titre, ingrédient, favoris).
 */
export function Sommaire({
  livre,
  recettes,
  filtre,
  surFiltre,
  surOuvrirRecette,
  surOuvrirAilleurs,
  surNouvelleRecette,
  surCompte,
  surAmis,
  surEtagere,
  surTransmettreLivre,
  defilementInitial = 0,
  surDefilement,
}: Props) {
  const refPage = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const { livres, recettes: toutes } = useEtatDepot();

  // Au retour d'une recette, on retrouve le sommaire à l'endroit où on l'avait laissé
  useLayoutEffect(() => {
    if (refPage.current) refPage.current.scrollTop = defilementInitial;
    // (uniquement à l'ouverture de la page)
  }, []);

  // Numéros de chapitre : continus d'une catégorie à l'autre, fixes même filtrés
  const numeros = useMemo(() => {
    const carte = new Map<string, number>();
    let n = 0;
    for (const categorie of CATEGORIES) {
      for (const r of recettes) if (r.categorie === categorie) carte.set(r.id, ++n);
    }
    return carte;
  }, [recettes]);

  const filtreActif = filtre.texte.trim() !== '' || filtre.favoris;
  const dansToute = filtre.partout && filtre.texte.trim() !== '';
  const resultats = useMemo(
    () => (filtreActif ? rechercher(dansToute ? toutes : recettes, filtre.texte, filtre.favoris) : null),
    [filtreActif, dansToute, toutes, recettes, filtre.texte, filtre.favoris],
  );
  /** Ingrédients trouvés, par recette (affichés sous le titre). */
  const indices = new Map(resultats?.map((r) => [r.recette.id, r.ingredients]) ?? []);
  const visibles = resultats ? recettes.filter((r) => indices.has(r.id)) : recettes;

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

      {/* Courrier et amis (compte connecté), ou réglages du compte (mode local) */}
      {social.actif ? (
        <button type="button" className="bouton-compte" onClick={surAmis} aria-label="Cercle des amis et courrier">
          <IconeCourrier />
          <Pastille nombre={social.total} />
        </button>
      ) : (
        <button type="button" className="bouton-compte" onClick={surCompte} aria-label="Compte">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
          </svg>
        </button>
      )}

      <header className="frontispice">
        <div className="frontispice__symbole">
          <Symbole nom={livre.symbole} taille={44} />
        </div>
        <h1 className="frontispice__titre">{livre.titre}</h1>
        <p className="frontispice__sous-titre">
          {livre.transmisPar ? `Transmis par ${livre.transmisPar}` : 'Table des chapitres'}
        </p>
        <Ornement />
      </header>

      {recettes.length > 0 && (
        <BarreRecherche
          texte={filtre.texte}
          favoris={filtre.favoris}
          partout={filtre.partout}
          surTexte={(texte) => surFiltre({ ...filtre, texte })}
          surFavoris={(favoris) => surFiltre({ ...filtre, favoris })}
          surPartout={(partout) => surFiltre({ ...filtre, partout })}
        />
      )}

      {dansToute && resultats ? (
        <ResultatsRecherche
          resultats={resultats}
          livres={livres}
          surOuvrir={(livreId, recetteId) =>
            livreId === livre.id ? surOuvrirRecette(recetteId) : surOuvrirAilleurs(livreId, recetteId)
          }
        />
      ) : (
        <>
          {CATEGORIES.map((categorie) => {
            const chapitres = visibles.filter((r) => r.categorie === categorie);
            if (chapitres.length === 0) return null;
            return (
              <section key={categorie} className="categorie">
                <h2 className="categorie__titre">{categorie}</h2>
                <ol className="chapitres">
                  {chapitres.map((recette) => {
                    const ingredients = indices.get(recette.id) ?? [];
                    return (
                      <li key={recette.id}>
                        <button type="button" className="chapitre" onClick={() => surOuvrirRecette(recette.id)}>
                          <span className="chapitre__vignette">
                            {recette.photoPrincipale ? (
                              <ImageCollee id={recette.photoPrincipale} format="vignette" />
                            ) : (
                              <Symbole nom={recette.symbole} taille={22} />
                            )}
                          </span>
                          <span className="chapitre__numero">{enChiffresRomains(numeros.get(recette.id) ?? 0)}.</span>
                          <span className="chapitre__titre">
                            {recette.titre}
                            {recette.favori && (
                              <span className="chapitre__favori" title="Favori" aria-label="Favori">
                                {' '}
                                ✦
                              </span>
                            )}
                            {ingredients.length > 0 && <small className="chapitre__indice">avec {ingredients.join(', ')}</small>}
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
          {filtreActif && visibles.length === 0 && (
            <p className="sommaire__vide">
              {filtre.favoris && !filtre.texte.trim()
                ? 'Aucune recette favorite dans ce livre. Touchez « Favori » sur une recette pour lui poser un marque-page doré.'
                : 'Aucune recette ne correspond dans ce livre.'}
            </p>
          )}
        </>
      )}

      {recettes.length === 0 && (
        <p className="sommaire__vide">Ce grimoire est encore vierge. Écrivez-y votre première recette !</p>
      )}

      <footer className="sommaire__pied">
        <button type="button" className="bouton bouton--principal" onClick={surNouvelleRecette}>
          + Nouvelle recette
        </button>
        {social.actif && recettes.length > 0 && (
          <button type="button" className="bouton" onClick={surTransmettreLivre}>
            Transmettre ce livre à des amis
          </button>
        )}
        <Ornement />
      </footer>
    </div>
  );
}
