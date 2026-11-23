// État social partagé par toute l'appli : profil, compteurs de la pastille.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BaseNonAJour, chargerProfil, compter, nettoyerEnvois, type Compteurs, type Profil } from './social';

export interface EtatSocial {
  /** Faux en mode local (sans compte) : la partie sociale est alors masquée. */
  actif: boolean;
  /** null tant qu'on ne sait pas ; false si la base n'a pas les tables nécessaires. */
  disponible: boolean | null;
  uid: string;
  profil: Profil | null;
  compteurs: Compteurs;
  /** Nombre affiché sur la pastille. */
  total: number;
  /** Recharge le profil et les compteurs. */
  rafraichir: () => Promise<void>;
  setProfil: (profil: Profil) => void;
}

const VIDE: Compteurs = { transmissions: 0, demandes: 0, nouveautes: 0 };

const ContexteSocial = createContext<EtatSocial>({
  actif: false,
  disponible: false,
  uid: '',
  profil: null,
  compteurs: VIDE,
  total: 0,
  rafraichir: async () => {},
  setProfil: () => {},
});

export const useSocial = () => useContext(ContexteSocial);

/** Intervalle de vérification des nouveautés quand l'appli est ouverte. */
const INTERVALLE = 60_000;

export function FournisseurSocial({ uid, actif, children }: { uid: string; actif: boolean; children: ReactNode }) {
  const [disponible, setDisponible] = useState<boolean | null>(actif ? null : false);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [compteurs, setCompteurs] = useState<Compteurs>(VIDE);

  const menageFait = useRef(false);

  const rafraichir = useCallback(async () => {
    if (!actif || !navigator.onLine) return;
    try {
      const [p, c] = await Promise.all([chargerProfil(uid), compter(uid)]);
      setProfil(p);
      setCompteurs(c);
      setDisponible(true);
      // Une fois par session : ménage des envois auxquels tout le monde a répondu
      if (!menageFait.current) {
        menageFait.current = true;
        void nettoyerEnvois(uid).catch((e) => console.warn('Ménage des envois impossible', e));
      }
    } catch (erreur) {
      if (erreur instanceof BaseNonAJour) setDisponible(false);
      else console.warn('Nouveautés indisponibles', erreur);
    }
  }, [actif, uid]);

  useEffect(() => {
    if (!actif) return;
    void rafraichir();
    const minuterie = setInterval(() => document.visibilityState === 'visible' && void rafraichir(), INTERVALLE);
    const auRetour = () => document.visibilityState === 'visible' && void rafraichir();
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', auRetour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', auRetour);
    };
  }, [actif, rafraichir]);

  const total = compteurs.transmissions + compteurs.demandes + compteurs.nouveautes;

  // Pastille sur l'icône de l'appli installée, là où le système le permet
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    void (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge?.())?.catch(() => {});
  }, [total]);

  const valeur = useMemo(
    () => ({ actif, disponible, uid, profil, compteurs, total, rafraichir, setProfil }),
    [actif, disponible, uid, profil, compteurs, total, rafraichir],
  );
  return <ContexteSocial.Provider value={valeur}>{children}</ContexteSocial.Provider>;
}
