import type { CSSProperties } from 'react';
import type { ApparenceLivre } from '../types';
import { Symbole } from './Symbole';
import './couverture.css';

interface Props {
  livre: ApparenceLivre;
}

/**
 * Couverture d'un livre : cuir de la couleur choisie, filets dorés,
 * médaillon avec le symbole et titre. Elle remplit son conteneur et tout
 * s'adapte à sa largeur (utilisée dans l'intro, puis sur l'étagère).
 */
export function Couverture({ livre }: Props) {
  return (
    <div className="couverture" style={{ '--cuir-livre': livre.couleurCuir } as CSSProperties}>
      <div className="couverture__cadre">
        <div className="couverture__medaillon">
          <Symbole nom={livre.symbole} taille={64} />
        </div>
        <p className="couverture__titre">{livre.titre}</p>
      </div>
    </div>
  );
}
