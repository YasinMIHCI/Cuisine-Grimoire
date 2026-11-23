import { useId, useState } from 'react';

interface Props {
  libelle: string;
  valeur: string;
  surChangement: (valeur: string) => void;
  /** Nouveau mot de passe (création, changement) ou mot de passe actuel. */
  nouveau?: boolean;
}

/** Longueur minimale d'un mot de passe. */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

/** Champ de mot de passe, avec un bouton pour l'afficher en clair. */
export function ChampMotDePasse({ libelle, valeur, surChangement, nouveau }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="champ">
      <label htmlFor={id}>
        <span>{libelle}</span>
      </label>
      <div className="champ-mot-de-passe">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={nouveau ? LONGUEUR_MIN_MOT_DE_PASSE : undefined}
          autoComplete={nouveau ? 'new-password' : 'current-password'}
          value={valeur}
          onChange={(e) => surChangement(e.target.value)}
          aria-describedby={nouveau ? `${id}-aide` : undefined}
        />
        <button
          type="button"
          className="champ-mot-de-passe__oeil"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {nouveau && (
        <small id={`${id}-aide`} className="champ__aide">
          Au moins {LONGUEUR_MIN_MOT_DE_PASSE} caractères.
        </small>
      )}
    </div>
  );
}
