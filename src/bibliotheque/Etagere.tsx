import { useMemo, useState } from 'react';
import type { Livre } from '../types';
import { CouvertureLivre } from '../composants/Couverture';
import { PanneauCompte } from '../composants/PanneauCompte';
import { BarreRecherche, ResultatsRecherche } from '../composants/ResultatsRecherche';
import { useEtatDepot } from '../donnees/contexte';
import { rechercher } from '../utilitaires/recherche';
import { useSocial } from '../amis/contexte';
import { IconeCourrier, Pastille } from '../amis/Pastille';
import { EditeurLivre } from './EditeurLivre';
import './etagere.css';

interface Props {
  livres: Livre[];
  /** Nombre de recettes par livre (identifiant → nombre). */
  nombreRecettes: Map<string, number>;
  surOuvrir: (id: string) => void;
  /** Ouvre une recette trouvée par la recherche. */
  surOuvrirRecette: (livreId: string, recetteId: string) => void;
  surAmis: () => void;
}

/**
 * L'étagère : tous les livres de l'utilisateur, posés sur des planches de bois
 * et reconnaissables à leur couverture. On y crée, personnalise et supprime
 * les livres.
 */
export function Etagere({ livres, nombreRecettes, surOuvrir, surOuvrirRecette, surAmis }: Props) {
  /** Livre en cours de personnalisation ; 'nouveau' pour une création. */
  const [edition, setEdition] = useState<Livre | 'nouveau' | null>(null);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const social = useSocial();
  const { recettes } = useEtatDepot();
  // Recherche dans toute la bibliothèque
  const [texte, setTexte] = useState('');
  const [favoris, setFavoris] = useState(false);
  const enRecherche = texte.trim() !== '' || favoris;
  const resultats = useMemo(
    () => (enRecherche ? rechercher(recettes, texte, favoris) : []),
    [enRecherche, recettes, texte, favoris],
  );

  return (
    <main className="etagere">
      <header className="etagere__entete">
        {social.actif && (
          <button type="button" className="bouton-etagere" onClick={surAmis} aria-label="Cercle des amis et courrier">
            <IconeCourrier />
            <Pastille nombre={social.total} />
          </button>
        )}
        <h1 className="etagere__titre">Ma bibliothèque</h1>
        <button type="button" className="bouton-compte" onClick={() => setCompteOuvert(true)} aria-label="Compte">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-5 4-7 8-7s7 2 8 7" />
          </svg>
        </button>
      </header>

      {recettes.length > 0 && (
        <div className="etagere__recherche">
          <BarreRecherche texte={texte} favoris={favoris} surTexte={setTexte} surFavoris={setFavoris} />
        </div>
      )}

      {enRecherche ? (
        <div className="etagere__resultats parchemin">
          <ResultatsRecherche resultats={resultats} livres={livres} surOuvrir={surOuvrirRecette} />
        </div>
      ) : (
      <ul className="etagere__rayons">
        {livres.map((livre) => {
          const n = nombreRecettes.get(livre.id) ?? 0;
          return (
            <li key={livre.id} className="etagere__case">
              <button
                type="button"
                className="etagere__livre"
                onClick={() => surOuvrir(livre.id)}
                aria-label={`Ouvrir « ${livre.titre} »`}
              >
                <CouvertureLivre livre={livre} />
              </button>
              <div className="etagere__etiquette">
                <span>
                  {n === 0 ? 'vierge' : `${n} recette${n > 1 ? 's' : ''}`}
                  {livre.transmisPar && ` · de ${livre.transmisPar}`}
                </span>
                <button
                  type="button"
                  className="etagere__plume"
                  onClick={() => setEdition(livre)}
                  aria-label={`Personnaliser « ${livre.titre} »`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20c2-8 7-14 16-16-1 8-6 13-13 14zM4 20l6-7" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}

        {/* Emplacement libre : créer un livre */}
        <li className="etagere__case">
          <button type="button" className="etagere__livre etagere__livre--nouveau" onClick={() => setEdition('nouveau')}>
            <span aria-hidden="true">+</span>
            Nouveau livre
          </button>
          <div className="etagere__etiquette" />
        </li>
      </ul>
      )}

      {edition && <EditeurLivre livre={edition === 'nouveau' ? null : edition} surFermer={() => setEdition(null)} />}
      {compteOuvert && <PanneauCompte surFermer={() => setCompteOuvert(false)} />}
    </main>
  );
}
