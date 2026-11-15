// Session de l'utilisateur : qui est connecté ?
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, UID_LOCAL } from '../donnees/supabase';

export type Session =
  | { statut: 'chargement' }
  | { statut: 'deconnecte' }
  | { statut: 'connecte'; uid: string; email: string | null };

const ContexteSession = createContext<Session>({ statut: 'chargement' });

export const useSession = () => useContext(ContexteSession);

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
    const appliquer = (utilisateur: { id: string; email?: string } | undefined) =>
      setSession((ancienne) => {
        if (!utilisateur) return { statut: 'deconnecte' };
        // On garde le même objet si rien n'a changé (évite de recharger les données)
        if (ancienne.statut === 'connecte' && ancienne.uid === utilisateur.id) return ancienne;
        return { statut: 'connecte', uid: utilisateur.id, email: utilisateur.email ?? null };
      });

    void supabase.auth.getSession().then(({ data }) => appliquer(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_evenement, s) => appliquer(s?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  return <ContexteSession.Provider value={session}>{children}</ContexteSession.Provider>;
}

/** Adresse de retour après une connexion Google ou un e-mail de confirmation. */
export const adresseDeRetour = () => window.location.origin + import.meta.env.BASE_URL;
