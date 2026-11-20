import { useRef, useState, type FormEvent } from 'react';
import { useSocial } from './contexte';
import { Avatar } from './Avatar';
import { creerAvatar, enregistrerProfil, MOTIF_PSEUDO } from './social';

/**
 * Choix du pseudo (obligatoire pour les amis et le partage) et de l'avatar.
 * @param premiere vrai si l'utilisateur n'a pas encore de pseudo
 */
export function EditeurProfil({ premiere, surEnregistre }: { premiere?: boolean; surEnregistre?: () => void }) {
  const { uid, profil, setProfil } = useSocial();
  const [pseudo, setPseudo] = useState(profil?.pseudo ?? '');
  const [avatar, setAvatar] = useState<string | null>(profil?.avatar ?? null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const refFichier = useRef<HTMLInputElement>(null);

  const choisirPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    try {
      setAvatar(await creerAvatar(fichier));
    } catch {
      setErreur('Image illisible.');
    }
  };

  const enregistrer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    const propre = pseudo.trim();
    if (!MOTIF_PSEUDO.test(propre)) {
      setErreur('Pseudo invalide : 3 à 20 lettres, chiffres, points, tirets ou « _ » (sans espace).');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await enregistrerProfil(uid, { pseudo: propre, avatar });
      if (profil) setProfil({ ...profil, pseudo: propre, avatar });
      setInfo('Profil enregistré.');
      surEnregistre?.();
    } catch (e) {
      setErreur((e as Error).message);
    }
    setEnCours(false);
  };

  return (
    <form className="formulaire editeur-profil" onSubmit={enregistrer}>
      {premiere && (
        <p className="message">
          Pour échanger des recettes, choisissez un pseudo : c’est par lui que vos amis vous trouveront.
        </p>
      )}
      <div className="editeur-profil__avatar">
        <button type="button" onClick={() => refFichier.current?.click()} aria-label="Choisir un avatar">
          <Avatar pseudo={pseudo || null} avatar={avatar} taille={84} />
        </button>
        <input ref={refFichier} type="file" accept="image/*" hidden onChange={(e) => void choisirPhoto(e.target.files?.[0])} />
        <div>
          <button type="button" className="bouton bouton--petit" onClick={() => refFichier.current?.click()}>
            {avatar ? 'Changer l’avatar' : 'Choisir un avatar'}
          </button>
          {avatar && (
            <button type="button" className="bouton bouton--petit" onClick={() => setAvatar(null)}>
              Retirer
            </button>
          )}
        </div>
      </div>
      <label className="champ">
        <span>Pseudo</span>
        <input
          type="text"
          required
          maxLength={20}
          autoCapitalize="none"
          autoComplete="nickname"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
        />
      </label>
      {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
      {info && <p className="message" role="status">{info}</p>}
      <button type="submit" className="bouton bouton--principal" disabled={enCours}>
        Enregistrer
      </button>
    </form>
  );
}
