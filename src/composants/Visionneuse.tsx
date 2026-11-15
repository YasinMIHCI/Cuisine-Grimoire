import { useAdresseImage } from '../donnees/contexte';

/** Image agrandie en plein écran ; un tap (ou le bouton retour) la referme. */
export function Visionneuse({ id, surFermer }: { id: string; surFermer: () => void }) {
  const adresse = useAdresseImage(id);
  return (
    <button type="button" className="visionneuse" onClick={surFermer} aria-label="Fermer l’image">
      {adresse && <img src={adresse} alt="" />}
    </button>
  );
}
