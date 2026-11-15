import type { CSSProperties } from 'react';
import type { ApparenceLivre } from '../types';
import { useAdresseImage } from '../donnees/contexte';
import { Symbole } from './Symbole';
import './couverture.css';

interface Props {
  livre: ApparenceLivre;
  /** Adresse d'une image de couverture ; elle remplace le symbole. */
  adresseImage?: string | null;
}

/**
 * Couverture d'un livre : cuir de la couleur choisie, filets dorés, symbole
 * (ou image) et titre. Elle remplit son conteneur et tout s'adapte à sa
 * largeur (intro, étagère, éditeur de livre).
 */
export function Couverture({ livre, adresseImage }: Props) {
  return (
    <div className="couverture" style={{ '--cuir-livre': livre.couleurCuir } as CSSProperties}>
      <div className="couverture__cadre">
        {adresseImage ? (
          <img className="couverture__image" src={adresseImage} alt="" draggable={false} />
        ) : (
          <div className="couverture__medaillon">
            <Symbole nom={livre.symbole} taille={64} />
          </div>
        )}
        <p className="couverture__titre">{livre.titre}</p>
      </div>
    </div>
  );
}

/** Couverture d'un livre du dépôt : va chercher son image de couverture. */
export function CouvertureLivre({ livre }: { livre: ApparenceLivre & { imageCouverture?: string | null } }) {
  const adresse = useAdresseImage(livre.imageCouverture);
  return <Couverture livre={livre} adresseImage={livre.imageCouverture ? adresse : null} />;
}
