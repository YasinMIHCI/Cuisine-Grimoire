import { useState, type FormEvent } from 'react';
import { supabase } from '../donnees/supabase';
import { Ornement } from '../composants/Ornement';
import { ChampMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from './ChampMotDePasse';
import { traduireErreurAuth } from './erreurs';

/**
 * Choix d'un nouveau mot de passe, après avoir ouvert le lien « mot de passe
 * oublié » reçu par e-mail (on est alors connecté pour ce seul usage).
 */
export function EcranNouveauMotDePasse({ surTermine }: { surTermine: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErreur(null);
    if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setEnCours(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) setErreur(traduireErreurAuth(error.message));
      else surTermine();
    } catch (err) {
      setErreur(traduireErreurAuth((err as Error).message));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <main className="cadre-livre">
      <div className="feuille">
        <div className="feuille__recto parchemin">
          <div className="page page--defilante">
            <header className="frontispice">
              <h1 className="frontispice__titre">Nouveau mot de passe</h1>
              <Ornement />
            </header>
            <form className="formulaire" onSubmit={valider}>
              <ChampMotDePasse libelle="Nouveau mot de passe" valeur={motDePasse} surChangement={setMotDePasse} nouveau />
              <ChampMotDePasse libelle="Confirmez-le" valeur={confirmation} surChangement={setConfirmation} nouveau />
              {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
              <button type="submit" className="bouton bouton--principal" disabled={enCours}>
                Enregistrer
              </button>
              <button type="button" className="bouton bouton--lien" onClick={() => void supabase?.auth.signOut()}>
                Annuler
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
