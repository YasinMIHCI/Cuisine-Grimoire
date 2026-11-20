import { useAdresseImage } from '../donnees/contexte';
import { usePanneauHistorique } from '../utilitaires/historique';

/**
 * Image agrandie en plein écran ; un tap (ou le geste retour) la referme.
 * L'image est soit une image de la bibliothèque (id), soit une adresse directe.
 */
export function Visionneuse({ id, adresse, surFermer }: { id?: string; adresse?: string; surFermer: () => void }) {
  const fermer = usePanneauHistorique(surFermer);
  const adresseLocale = useAdresseImage(id);
  const source = adresse ?? adresseLocale;
  return (
    <button type="button" className="visionneuse" onClick={fermer} aria-label="Fermer l’image">
      {source && <img src={source} alt="" />}
    </button>
  );
}
