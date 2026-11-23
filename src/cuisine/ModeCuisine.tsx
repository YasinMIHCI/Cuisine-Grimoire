import { useEffect, useRef, useState } from 'react';
import type { Recette } from '../types';
import { formaterQuantite } from '../utilitaires/format';
import { usePanneauHistorique } from '../utilitaires/historique';
import { usePiegeFocus } from '../utilitaires/focus';
import { ajusterQuantite, partagerTexte } from '../utilitaires/texte';
import { ImageCollee } from '../composants/ImageCollee';
import { demanderTexte, informer } from '../composants/Dialogues';
import { trouverDurees } from './minuteurs';
import { lancerMinuteur, preparerSon } from './minuteursEnCours';
import { ListeMinuteurs } from './BandeauMinuteurs';
import './cuisine.css';

interface Props {
  recette: Recette;
  portions: number;
  surFermer: () => void;
}

/**
 * Mode cuisine : écran maintenu allumé, texte agrandi, une étape à la fois.
 * La première page liste les ingrédients (à cocher) ; les durées écrites dans
 * les étapes deviennent des minuteurs d'un simple toucher. Les minuteurs
 * continuent après la fermeture du mode cuisine (voir minuteursEnCours.ts).
 */
export function ModeCuisine({ recette, portions, surFermer }: Props) {
  const fermer = usePanneauHistorique(surFermer);
  const refPiege = usePiegeFocus<HTMLDivElement>(fermer);
  const [page, setPage] = useState(0); // 0 : ingrédients, 1…n : étapes, n+1 : fin
  const [coches, setCoches] = useState<Set<number>>(new Set());
  const [ecranAllume, setEcranAllume] = useState(false);
  const derniere = recette.etapes.length + 1;
  const facteur = portions / recette.portions;

  // --- Écran maintenu allumé (Wake Lock API) ; redemandé au retour dans l'appli
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let actif = true;
    const demander = async () => {
      try {
        verrou = (await navigator.wakeLock?.request('screen')) ?? null;
        setEcranAllume(verrou !== null);
        verrou?.addEventListener('release', () => setEcranAllume(false));
      } catch {
        setEcranAllume(false); // non pris en charge, ou batterie faible
      }
    };
    void demander();
    const auRetour = () => {
      if (actif && document.visibilityState === 'visible') void demander();
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      actif = false;
      document.removeEventListener('visibilitychange', auRetour);
      void verrou?.release();
    };
  }, []);

  const minuteurLibre = async () => {
    // Le son est débloqué tout de suite : après le dialogue, ce ne serait plus un geste direct
    preparerSon();
    const reponse = await demanderTexte('Durée du minuteur, en minutes :', { valeur: '10', numerique: true, oui: 'Lancer' });
    const minutes = reponse ? parseFloat(reponse.replace(',', '.')) : NaN;
    if (minutes > 0 && minutes <= 48 * 60) lancerMinuteur(recette.titre, `${formaterQuantite(minutes)} min`, minutes * 60);
  };

  const aller = (pas: number) => setPage((p) => Math.min(derniere, Math.max(0, p + pas)));

  // Clavier (PC) et gestes. (Échap referme : voir usePiegeFocus.)
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      // Espace sur un bouton ou une case à cocher : c'est à eux de réagir
      const cible = e.target as Element;
      if (cible.closest('button, input, textarea, select') && e.key === ' ') return;
      if (document.querySelector('.voile--dialogue')) return; // un dialogue est ouvert
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        aller(1);
      } else if (e.key === 'ArrowLeft') aller(-1);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });
  const depart = useRef<number | null>(null);

  const listeCourses = async () => {
    const restants = recette.ingredients.filter((_, i) => !coches.has(i));
    const texte = [`Courses pour « ${recette.titre} » (${portions} portions) :`, ...restants.map((i) => `- ${ligneIngredient(i, facteur)}`)].join('\n');
    const resultat = await partagerTexte(`Courses : ${recette.titre}`, texte);
    if (resultat === 'copie') await informer('Liste copiée.');
  };

  const etape = page >= 1 && page < derniere ? recette.etapes[page - 1] : null;

  return (
    <div
      ref={refPiege}
      className="cuisine"
      role="dialog"
      aria-modal="true"
      aria-label={`Mode cuisine : ${recette.titre}`}
      onPointerDown={(e) => {
        depart.current = (e.target as Element).closest('button, input, label') ? null : e.clientX;
      }}
      onPointerUp={(e) => {
        if (depart.current === null) return;
        const dx = e.clientX - depart.current;
        depart.current = null;
        if (Math.abs(dx) > 50) aller(dx < 0 ? 1 : -1);
      }}
    >
      <header className="cuisine__entete">
        <button type="button" className="cuisine__fermer" onClick={fermer} aria-label="Quitter le mode cuisine">
          ×
        </button>
        <div className="cuisine__titre">
          <span>{recette.titre}</span>
          <small>{ecranAllume ? 'Écran maintenu allumé' : 'Mode cuisine'}</small>
        </div>
        <button type="button" className="cuisine__minuteur-libre" onClick={() => void minuteurLibre()}>
          + Minuteur
        </button>
      </header>

      <ListeMinuteurs />

      {/* Barre de progression */}
      <div className="cuisine__progression" aria-hidden="true">
        <span style={{ width: `${(page / derniere) * 100}%` }} />
      </div>

      <main className="cuisine__contenu">
        {page === 0 && (
          <>
            <h2 className="cuisine__rubrique">
              Ingrédients <small>pour {portions} portion{portions > 1 ? 's' : ''}</small>
            </h2>
            <ul className="cuisine__ingredients">
              {recette.ingredients.map((ingredient, i) => (
                <li key={i}>
                  <label className={coches.has(i) ? 'coche coche--faite' : 'coche'}>
                    <input
                      type="checkbox"
                      checked={coches.has(i)}
                      onChange={() =>
                        setCoches((actuel) => {
                          const suivant = new Set(actuel);
                          if (suivant.has(i)) suivant.delete(i);
                          else suivant.add(i);
                          return suivant;
                        })
                      }
                    />
                    <span>{ligneIngredient(ingredient, facteur)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="bouton" onClick={listeCourses}>
              Partager la liste de courses
            </button>
          </>
        )}

        {etape && (
          <>
            <h2 className="cuisine__rubrique">
              Étape {page} <small>sur {recette.etapes.length}</small>
            </h2>
            <p className="cuisine__texte">{etape.texte}</p>
            {trouverDurees(etape.texte).map((d, i) => (
              <button key={i} type="button" className="bouton cuisine__duree" onClick={() => lancerMinuteur(recette.titre, `Étape ${page} · ${d.libelle}`, d.secondes)}>
                ⏱ Minuteur : {d.libelle}
              </button>
            ))}
            {etape.image && <ImageCollee id={etape.image} format="principale" />}
          </>
        )}

        {page === derniere && (
          <div className="cuisine__fin">
            <h2 className="cuisine__rubrique">Bon appétit !</h2>
            <p>La recette est terminée.</p>
            <button type="button" className="bouton bouton--principal" onClick={fermer}>
              Quitter le mode cuisine
            </button>
          </div>
        )}
      </main>

      <footer className="cuisine__pied">
        <button type="button" className="bouton" onClick={() => aller(-1)} disabled={page === 0}>
          ‹ Précédent
        </button>
        <button type="button" className="bouton bouton--principal" onClick={() => aller(1)} disabled={page === derniere}>
          {page === 0 ? 'Commencer ›' : 'Suivant ›'}
        </button>
      </footer>
    </div>
  );
}

function ligneIngredient(i: Recette['ingredients'][number], facteur: number) {
  const quantite = i.quantite !== null ? `${formaterQuantite(ajusterQuantite(i.quantite, facteur, i.unite))}${i.unite ? ` ${i.unite}` : ''} ` : '';
  return `${quantite}${i.nom}`;
}
