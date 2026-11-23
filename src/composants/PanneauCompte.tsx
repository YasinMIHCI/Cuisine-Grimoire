import { useState, type FormEvent } from 'react';
import { useSession } from '../auth/session';
import { ChampMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from '../auth/ChampMotDePasse';
import { traduireErreurAuth } from '../auth/erreurs';
import { useDepot, useEtatDepot } from '../donnees/contexte';
import type { EtatSynchro } from '../donnees/depot';
import { effacerDonneesLocales, supprimerCompte } from '../donnees/compte';
import { supabase } from '../donnees/supabase';
import { ecrireReglageIntro, lireReglageIntro, type ReglageIntro } from '../intro/reglage';
import { usePanneauHistorique } from '../utilitaires/historique';
import { usePiegeFocus } from '../utilitaires/focus';
import { Confidentialite } from './Confidentialite';
import { confirmer, demanderTexte, informer } from './Dialogues';

const LIBELLES: Record<EtatSynchro, string> = {
  locale: 'Mode local : les recettes restent sur cet appareil.',
  'en-cours': 'Synchronisation en cours…',
  'a-jour': 'Tout est synchronisé.',
  'hors-ligne': 'Hors ligne : la synchronisation reprendra au retour du réseau.',
  erreur: 'La synchronisation a échoué.',
};

/**
 * Panneau « compte » : adresse, état de la synchronisation, réglages,
 * mot de passe, déconnexion et suppression du compte.
 */
export function PanneauCompte({ surFermer }: { surFermer: () => void }) {
  const fermer = usePanneauHistorique(surFermer);
  const ref = usePiegeFocus<HTMLDivElement>(fermer);
  const session = useSession();
  const depot = useDepot();
  const etat = useEtatDepot();
  const [intro, setIntro] = useState<ReglageIntro>(lireReglageIntro);
  const [effacer, setEffacer] = useState(true);
  const [motDePasseOuvert, setMotDePasseOuvert] = useState(false);
  const [nouveau, setNouveau] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confidentialite, setConfidentialite] = useState(false);
  const uid = session.statut === 'connecte' ? session.uid : null;

  const changerIntro = (valeur: ReglageIntro) => {
    setIntro(valeur);
    ecrireReglageIntro(valeur);
  };

  const changerMotDePasse = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErreur(null);
    setInfo(null);
    if (nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: nouveau });
    if (error) setErreur(traduireErreurAuth(error.message));
    else {
      setInfo('Mot de passe enregistré.');
      setNouveau('');
      setMotDePasseOuvert(false);
    }
  };

  const seDeconnecter = async () => {
    if (!supabase || !uid) return;
    const attente = await depot.nombreEnAttente();
    if (attente > 0) {
      const message = effacer
        ? `${attente} modification${attente > 1 ? 's' : ''} n’${attente > 1 ? 'ont' : 'a'} pas encore été envoyée${attente > 1 ? 's' : ''} dans le cloud et ser${attente > 1 ? 'ont' : 'a'} perdue${attente > 1 ? 's' : ''}. Se déconnecter quand même ?`
        : `${attente} modification${attente > 1 ? 's' : ''} attend${attente > 1 ? 'ent' : ''} encore d’être envoyée${attente > 1 ? 's' : ''} : elle${attente > 1 ? 's' : ''} le ser${attente > 1 ? 'ont' : 'a'} à la prochaine connexion sur cet appareil. Se déconnecter ?`;
      if (!(await confirmer(message, { oui: 'Se déconnecter', danger: effacer }))) return;
    }
    setEnCours('Déconnexion…');
    await supabase.auth.signOut({ scope: 'local' });
    if (effacer) await effacerDonneesLocales(uid);
  };

  const supprimer = async () => {
    if (!uid) return;
    const reponse = await demanderTexte(
      'Votre compte, vos livres, vos recettes, vos photos et vos amis seront effacés définitivement. Pour confirmer, écrivez SUPPRIMER.',
      { titre: 'Supprimer mon compte', oui: 'Supprimer définitivement', danger: true },
    );
    if (reponse === null) return;
    if (reponse.trim().toUpperCase() !== 'SUPPRIMER') {
      await informer('Le mot SUPPRIMER n’a pas été écrit : rien n’a été effacé.');
      return;
    }
    setErreur(null);
    try {
      await supprimerCompte(uid, setEnCours);
    } catch (e) {
      setEnCours(null);
      setErreur((e as Error).message);
    }
  };

  return (
    <>
    <div className="voile" onClick={fermer}>
      <div
        ref={ref}
        className="panneau panneau--defilant parchemin formulaire"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-compte"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titre-compte" className="recette__section">
          Compte
        </h2>
        {session.statut === 'connecte' && session.email && <p>{session.email}</p>}
        <p className={etat.synchro === 'erreur' ? 'message message--erreur' : 'message'} role="status">
          {LIBELLES[etat.synchro]}
          {etat.synchro === 'erreur' && etat.erreur && <small> ({etat.erreur})</small>}
        </p>
        {depot.enLigne && (
          <button type="button" className="bouton" onClick={() => void depot.synchroniser()} disabled={enCours !== null}>
            Synchroniser maintenant
          </button>
        )}

        <label className="champ">
          <span>Animation d’ouverture</span>
          <select value={intro} onChange={(e) => changerIntro(e.target.value as ReglageIntro)}>
            <option value="jour">Une fois par jour</option>
            <option value="toujours">À chaque ouverture</option>
            <option value="jamais">Jamais</option>
          </select>
        </label>

        {depot.enLigne && (
          <>
            {!motDePasseOuvert ? (
              <button type="button" className="bouton" onClick={() => setMotDePasseOuvert(true)}>
                {session.statut === 'connecte' && session.avecMotDePasse === false ? 'Définir un mot de passe' : 'Changer de mot de passe'}
              </button>
            ) : (
              <form onSubmit={changerMotDePasse}>
                <ChampMotDePasse libelle="Nouveau mot de passe" valeur={nouveau} surChangement={setNouveau} nouveau />
                <div className="formulaire__actions">
                  <button type="submit" className="bouton bouton--principal">
                    Enregistrer
                  </button>
                  <button type="button" className="bouton" onClick={() => setMotDePasseOuvert(false)}>
                    Annuler
                  </button>
                </div>
              </form>
            )}

            <label className="case-a-cocher">
              <input type="checkbox" checked={effacer} onChange={(e) => setEffacer(e.target.checked)} />
              <span>Effacer mes recettes de cet appareil en me déconnectant (conseillé sur un appareil partagé)</span>
            </label>
            <button type="button" className="bouton" onClick={seDeconnecter} disabled={enCours !== null}>
              Se déconnecter
            </button>
          </>
        )}

        {info && <p className="message" role="status">{info}</p>}
        {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
        {enCours && <p className="message" role="status">{enCours}</p>}

        <button type="button" className="bouton bouton--lien" onClick={() => setConfidentialite(true)}>
          Confidentialité et données personnelles
        </button>
        {depot.enLigne && (
          <button type="button" className="bouton bouton--lien bouton--lien-danger" onClick={supprimer} disabled={enCours !== null}>
            Supprimer mon compte
          </button>
        )}
        <button type="button" className="bouton bouton--lien" onClick={fermer}>
          Fermer
        </button>
      </div>
    </div>
    {confidentialite && <Confidentialite surFermer={() => setConfidentialite(false)} />}
    </>
  );
}
