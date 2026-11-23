import { useEffect, useState } from 'react';
import { partagerTexte } from '../utilitaires/texte';
import { useSocial } from './contexte';
import { confirmer } from '../composants/Dialogues';
import { changerCodeInvitation } from './social';

/** Adresse du lien d'invitation d'un code. */
export const lienInvitation = (code: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}?invitation=${encodeURIComponent(code)}`;

/**
 * Mon lien d'invitation, en QR code (à faire scanner avec l'appareil photo
 * d'un ami) et en lien à partager. Celui qui l'ouvre rejoint mon cercle.
 */
export function Invitation() {
  const { profil, setProfil } = useSocial();
  const [svg, setSvg] = useState<string>('');
  const [info, setInfo] = useState<string | null>(null);
  const lien = profil ? lienInvitation(profil.codeInvitation) : '';

  useEffect(() => {
    if (!lien) return;
    let annule = false;
    void import('qrcode')
      .then((QRCode) => QRCode.toString(lien, { type: 'svg', margin: 1, color: { dark: '#2e1d10', light: '#00000000' } }))
      .then((s) => !annule && setSvg(s));
    return () => {
      annule = true;
    };
  }, [lien]);

  if (!profil) return null;

  const partager = async () => {
    const texte = `Rejoins mon cercle sur le Grimoire de recettes pour échanger nos recettes : ${lien}`;
    const resultat = await partagerTexte('Mon grimoire de recettes', texte);
    if (resultat === 'copie') setInfo('Lien copié.');
  };

  const renouveler = async () => {
    if (!(await confirmer('Créer un nouveau lien ? L’ancien lien et son QR code ne fonctionneront plus.', { oui: 'Nouveau lien' }))) return;
    try {
      const code = await changerCodeInvitation();
      setProfil({ ...profil, codeInvitation: code });
      setInfo('Nouveau lien créé.');
    } catch (e) {
      setInfo((e as Error).message);
    }
  };

  return (
    <div className="invitation">
      {/* Le QR code est généré localement à partir du lien */}
      <div className="invitation__qr" aria-label="QR code de mon lien d’invitation" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="invitation__lien">{lien}</p>
      <button type="button" className="bouton" onClick={partager}>
        Partager mon lien
      </button>
      <button type="button" className="bouton bouton--lien" onClick={renouveler}>
        Créer un nouveau lien
      </button>
      {info && <p className="message" role="status">{info}</p>}
    </div>
  );
}
