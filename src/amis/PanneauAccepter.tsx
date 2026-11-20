import { useState } from 'react';
import { useDepot, useEtatDepot } from '../donnees/contexte';
import { usePanneauHistorique } from '../utilitaires/historique';
import { accepterTransmission, type TransmissionRecue } from './social';

interface Props {
  transmission: TransmissionRecue;
  surFermer: () => void;
  /** Appelé une fois la copie rangée (identifiant du livre). */
  surRangee: (livreId: string) => void;
}

/** Accepter une transmission : choisir où ranger sa copie. */
export function PanneauAccepter({ transmission, surFermer, surRangee }: Props) {
  const fermer = usePanneauHistorique(surFermer);
  const depot = useDepot();
  const { livres } = useEtatDepot();
  const estLivre = transmission.type === 'livre';
  // Un livre reçu va par défaut sur un nouveau livre de l'étagère ; une recette, dans le premier livre
  const [cible, setCible] = useState<string>(estLivre || livres.length === 0 ? 'nouveau' : livres[0].id);
  const [titreNouveau, setTitreNouveau] = useState(estLivre ? transmission.titre : 'Recettes reçues');
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ranger = async () => {
    setErreur(null);
    try {
      const livreId = await accepterTransmission(
        depot,
        transmission,
        cible === 'nouveau' ? { nouveauLivre: titreNouveau.trim() || transmission.titre } : { livreId: cible },
        setProgression,
      );
      surRangee(livreId);
      fermer();
    } catch (e) {
      setErreur((e as Error).message);
      setProgression(null);
    }
  };

  const n = transmission.contenu.recettes.length;
  return (
    <div className="voile" onClick={fermer}>
      <div className="panneau panneau--defilant parchemin formulaire" role="dialog" aria-label="Ranger la copie" onClick={(e) => e.stopPropagation()}>
        <h2 className="recette__section">Ranger dans la bibliothèque</h2>
        <p className="message">
          {estLivre ? `Le livre « ${transmission.titre} » (${n} recette${n > 1 ? 's' : ''})` : `La recette « ${transmission.titre} »`}, transmis
          par {transmission.expediteurPseudo}.
        </p>

        <fieldset className="choix-livre" disabled={progression !== null}>
          <legend>Où le ranger ?</legend>
          <label>
            <input type="radio" name="cible" checked={cible === 'nouveau'} onChange={() => setCible('nouveau')} />
            <span>Un nouveau livre :</span>
          </label>
          {cible === 'nouveau' && (
            <input
              type="text"
              aria-label="Titre du nouveau livre"
              value={titreNouveau}
              maxLength={40}
              onChange={(e) => setTitreNouveau(e.target.value)}
            />
          )}
          {livres.map((livre) => (
            <label key={livre.id}>
              <input type="radio" name="cible" checked={cible === livre.id} onChange={() => setCible(livre.id)} />
              <span>{livre.titre}</span>
            </label>
          ))}
        </fieldset>

        {progression && <p className="message" role="status">{progression}</p>}
        {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
        <button type="button" className="bouton bouton--principal" disabled={progression !== null} onClick={ranger}>
          Ranger ma copie
        </button>
        <button type="button" className="bouton bouton--lien" onClick={fermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}
