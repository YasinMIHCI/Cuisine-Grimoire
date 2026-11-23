import { useState, type CSSProperties, type FormEvent } from 'react';
import { COULEURS_CUIR, SYMBOLES, type Livre, type NomSymbole } from '../types';
import { ChoixPhoto } from '../composants/ChoixPhoto';
import { CouvertureLivre } from '../composants/Couverture';
import { Symbole } from '../composants/Symbole';
import { useDepot } from '../donnees/contexte';
import { confirmer } from '../composants/Dialogues';
import { usePanneauHistorique } from '../utilitaires/historique';

interface Props {
  /** Livre à modifier, ou null pour en créer un. */
  livre: Livre | null;
  surFermer: () => void;
}

/**
 * Création / personnalisation d'un livre : titre, couleur du cuir, symbole ou
 * image de couverture. L'aperçu de la couverture se met à jour en direct.
 */
export function EditeurLivre({ livre, surFermer }: Props) {
  const fermer = usePanneauHistorique(surFermer);
  const depot = useDepot();
  const [titre, setTitre] = useState(livre?.titre ?? '');
  const [couleurCuir, setCouleurCuir] = useState<string>(livre?.couleurCuir ?? COULEURS_CUIR[0]);
  const [symbole, setSymbole] = useState<NomSymbole>(livre?.symbole ?? 'chaudron');
  const [imageCouverture, setImageCouverture] = useState<string | null>(livre?.imageCouverture ?? null);

  const enregistrer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!titre.trim()) return;
    await depot.enregistrerLivre({ ...livre, titre: titre.trim(), couleurCuir, symbole, imageCouverture });
    fermer();
  };

  const supprimer = async () => {
    if (!livre) return;
    const message = `Supprimer définitivement « ${livre.titre} » et toutes ses recettes ?`;
    if (!(await confirmer(message, { oui: 'Supprimer', danger: true }))) return;
    await depot.supprimerLivre(livre.id);
    fermer();
  };

  return (
    <div className="voile" onClick={fermer}>
      <form
        className="panneau panneau--defilant parchemin formulaire"
        role="dialog"
        aria-label={livre ? 'Personnaliser le livre' : 'Nouveau livre'}
        onClick={(e) => e.stopPropagation()}
        onSubmit={enregistrer}
      >
        <h2 className="recette__section">{livre ? 'Personnaliser le livre' : 'Nouveau livre'}</h2>

        <div className="editeur-livre__apercu">
          <CouvertureLivre livre={{ titre: titre || 'Titre du livre', couleurCuir, symbole, imageCouverture }} />
        </div>

        <label className="champ">
          <span>Titre</span>
          <input
            type="text"
            required
            maxLength={40}
            placeholder="Desserts, Cuisine italienne…"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
          />
        </label>

        <div className="champ">
          <span>Couleur du cuir</span>
          <div className="pastilles" role="radiogroup" aria-label="Couleur du cuir">
            {COULEURS_CUIR.map((couleur) => (
              <button
                key={couleur}
                type="button"
                role="radio"
                aria-checked={couleur === couleurCuir}
                aria-label={couleur}
                className="pastille"
                style={{ '--couleur': couleur } as CSSProperties}
                onClick={() => setCouleurCuir(couleur)}
              />
            ))}
          </div>
        </div>

        <div className="champ">
          <span>Symbole</span>
          <div className="pastilles" role="radiogroup" aria-label="Symbole">
            {SYMBOLES.map((nom) => (
              <button
                key={nom}
                type="button"
                role="radio"
                aria-checked={!imageCouverture && nom === symbole}
                aria-label={nom}
                className="pastille pastille--symbole"
                onClick={() => {
                  setSymbole(nom);
                  setImageCouverture(null); // choisir un symbole retire l'image
                }}
              >
                <Symbole nom={nom} taille={24} />
              </button>
            ))}
          </div>
        </div>

        <div className="champ">
          <span>…ou une image de couverture</span>
          {imageCouverture ? (
            <button type="button" className="bouton bouton--petit" onClick={() => setImageCouverture(null)}>
              Retirer l’image
            </button>
          ) : (
            <ChoixPhoto surAjout={setImageCouverture} />
          )}
        </div>

        <div className="formulaire__actions">
          <button type="submit" className="bouton bouton--principal">
            {livre ? 'Enregistrer' : 'Créer le livre'}
          </button>
          <button type="button" className="bouton" onClick={fermer}>
            Annuler
          </button>
          {livre && (
            <button type="button" className="bouton bouton--danger" onClick={supprimer}>
              Supprimer le livre
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
