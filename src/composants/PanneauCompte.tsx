import { useSession } from '../auth/session';
import { useDepot, useEtatDepot } from '../donnees/contexte';
import type { EtatSynchro } from '../donnees/depot';
import { supabase } from '../donnees/supabase';

const LIBELLES: Record<EtatSynchro, string> = {
  locale: 'Mode local : les recettes restent sur cet appareil.',
  'en-cours': 'Synchronisation en cours…',
  'a-jour': 'Tout est synchronisé.',
  'hors-ligne': 'Hors ligne : la synchronisation reprendra au retour du réseau.',
  erreur: 'La synchronisation a échoué.',
};

/** Petit panneau « compte » : adresse, état de la synchronisation, déconnexion. */
export function PanneauCompte({ surFermer }: { surFermer: () => void }) {
  const session = useSession();
  const depot = useDepot();
  const etat = useEtatDepot();

  return (
    <div className="voile" onClick={surFermer}>
      <div className="panneau parchemin" role="dialog" aria-label="Compte" onClick={(e) => e.stopPropagation()}>
        <h2 className="recette__section">Compte</h2>
        {session.statut === 'connecte' && session.email && <p>{session.email}</p>}
        <p className={etat.synchro === 'erreur' ? 'message message--erreur' : 'message'}>
          {LIBELLES[etat.synchro]}
          {etat.synchro === 'erreur' && etat.erreur && <small> ({etat.erreur})</small>}
        </p>
        {depot.enLigne && (
          <>
            <button type="button" className="bouton" onClick={() => void depot.synchroniser()}>
              Synchroniser maintenant
            </button>
            <button type="button" className="bouton" onClick={() => void supabase?.auth.signOut()}>
              Se déconnecter
            </button>
          </>
        )}
        <button type="button" className="bouton bouton--lien" onClick={surFermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}
