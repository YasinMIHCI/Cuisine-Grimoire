import { useRef, useState } from 'react';
import { useDepot } from '../donnees/contexte';

interface Props {
  /** Reçoit l'identifiant de l'image une fois compressée et enregistrée. */
  surAjout: (idImage: string) => void;
  /** Autorise le choix de plusieurs photos d'un coup (galerie). */
  multiple?: boolean;
}

/**
 * Deux boutons pour ajouter une photo : appareil photo du téléphone, ou
 * galerie / fichiers. L'image est compressée avant d'être enregistrée.
 */
export function ChoixPhoto({ surAjout, multiple }: Props) {
  const depot = useDepot();
  const refAppareil = useRef<HTMLInputElement>(null);
  const refGalerie = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);

  const traiter = async (champ: HTMLInputElement) => {
    const fichiers = Array.from(champ.files ?? []);
    champ.value = ''; // permet de rechoisir la même photo
    if (fichiers.length === 0) return;
    setEnCours(true);
    setErreur(false);
    try {
      for (const fichier of fichiers) surAjout(await depot.ajouterImage(fichier));
    } catch {
      setErreur(true);
    }
    setEnCours(false);
  };

  return (
    <span className="choix-photo">
      {/* `capture` ouvre directement l'appareil photo sur téléphone */}
      <input ref={refAppareil} type="file" accept="image/*" capture="environment" hidden onChange={(e) => traiter(e.target)} />
      <input ref={refGalerie} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => traiter(e.target)} />
      <button type="button" className="bouton bouton--petit" disabled={enCours} onClick={() => refAppareil.current?.click()}>
        Appareil photo
      </button>
      <button type="button" className="bouton bouton--petit" disabled={enCours} onClick={() => refGalerie.current?.click()}>
        Galerie
      </button>
      {enCours && <span className="message">Préparation…</span>}
      {erreur && <span className="message message--erreur">Image illisible.</span>}
    </span>
  );
}
