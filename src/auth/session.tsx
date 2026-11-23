// Session de l'utilisateur : qui est connecté ?
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, UID_LOCAL } from '../donnees/supabase';

export type Session =
  | { statut: 'chargement' }
  | { statut: 'deconnecte' }
  | {
      statut: 'connecte';
      uid: string;
      email: string | null;
      /** Vrai après avoir ouvert le lien « mot de passe oublié » : il faut en choisir un nouveau. */
      motDePasseAChanger?: boolean;
      /** Le compte a un mot de passe (et non seulement Google). */
      avecMotDePasse?: boolean;
    };

interface ValeurSession {
  session: Session;
  /** Le nouveau mot de passe a été enregistré. */
  motDePasseChange: () => void;
}

const ContexteSession = createContext<ValeurSession>({ session: { statut: 'chargement' }, motDePasseChange: () => {} });

export const useSession = () => useContext(ContexteSession).session;
export const useMotDePasseChange = () => useContext(ContexteSession).motDePasseChange;

interface Utilisateur {
  id: string;
  email?: string;
  identities?: { provider: string }[] | null;
  app_metadata?: { providers?: string[] };
}

/**
 * Suit l'état de connexion Supabase. La session est mémorisée sur l'appareil :
 * on reste connecté d'un lancement à l'autre, même hors ligne.
 * Sans Supabase configuré, on est « connecté » en mode local.
 */
export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(
    supabase ? { statut: 'chargement' } : { statut: 'connecte', uid: UID_LOCAL, email: null },
  );

  useEffect(() => {
    if (!supabase) return;
    const appliquer = (utilisateur: Utilisateur | undefined, recuperation = false) =>
      setSession((ancienne) => {
        if (!utilisateur) return { statut: 'deconnecte' };
        const fournisseurs = utilisateur.app_metadata?.providers ?? utilisateur.identities?.map((i) => i.provider) ?? [];
        const avecMotDePasse = fournisseurs.includes('email');
        const aChanger = recuperation || (ancienne.statut === 'connecte' && ancienne.motDePasseAChanger === true);
        // On garde le même objet si rien n'a changé (évite de recharger les données)
        if (
          ancienne.statut === 'connecte' &&
          ancienne.uid === utilisateur.id &&
          ancienne.motDePasseAChanger === aChanger &&
          ancienne.avecMotDePasse === avecMotDePasse
        ) {
          return ancienne;
        }
        return {
          statut: 'connecte',
          uid: utilisateur.id,
          email: utilisateur.email ?? null,
          motDePasseAChanger: aChanger,
          avecMotDePasse,
        };
      });

    void supabase.auth.getSession().then(({ data }) => appliquer(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((evenement, s) =>
      appliquer(s?.user, evenement === 'PASSWORD_RECOVERY'),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const motDePasseChange = () =>
    setSession((s) => (s.statut === 'connecte' ? { ...s, motDePasseAChanger: false, avecMotDePasse: true } : s));

  return <ContexteSession.Provider value={{ session, motDePasseChange }}>{children}</ContexteSession.Provider>;
}

/** Adresse de retour après une connexion Google ou un e-mail de confirmation. */
export const adresseDeRetour = () => window.location.origin + import.meta.env.BASE_URL;
