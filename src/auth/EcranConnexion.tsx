import { useState, type FormEvent } from 'react';
import { supabase } from '../donnees/supabase';
import { Ornement } from '../composants/Ornement';
import { Symbole } from '../composants/Symbole';
import { Confidentialite } from '../composants/Confidentialite';
import { ChampMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from './ChampMotDePasse';
import { traduireErreurAuth } from './erreurs';
import { adresseDeRetour } from './session';

type Mode = 'connexion' | 'inscription' | 'oubli';

const SOUS_TITRES: Record<Mode, string> = {
  connexion: 'Ouvrez votre bibliothèque',
  inscription: 'Créez votre bibliothèque',
  oubli: 'Retrouvez la clé de votre bibliothèque',
};

/** Écran de connexion : e-mail + mot de passe, ou compte Google ; mot de passe oublié. */
export function EcranConnexion() {
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confidentialite, setConfidentialite] = useState(false);

  const changerMode = (nouveau: Mode) => {
    setMode(nouveau);
    setErreur(null);
    setInfo(null);
  };

  const valider = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!supabase) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      if (mode === 'connexion') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
        if (error) setErreur(traduireErreurAuth(error.message));
      } else if (mode === 'inscription') {
        if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
          setErreur(`Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: motDePasse,
          options: { emailRedirectTo: adresseDeRetour() },
        });
        if (error) setErreur(traduireErreurAuth(error.message));
        // Selon le réglage Supabase, il faut confirmer son e-mail avant d'être connecté
        else if (!data.session) setInfo('Compte créé ! Ouvrez le lien reçu par e-mail pour le confirmer.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: adresseDeRetour() });
        if (error) setErreur(traduireErreurAuth(error.message));
        else
          setInfo(
            'Si un compte existe avec cette adresse, un e-mail vient de partir. Ouvrez le lien qu’il contient pour choisir un nouveau mot de passe.',
          );
      }
    } catch (e) {
      setErreur(traduireErreurAuth((e as Error).message));
    } finally {
      setEnCours(false);
    }
  };

  const avecGoogle = async () => {
    if (!supabase) return;
    setErreur(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: adresseDeRetour() },
    });
    if (error) setErreur(traduireErreurAuth(error.message));
  };

  return (
    <main className="cadre-livre">
      <div className="feuille">
        <div className="feuille__recto parchemin">
          <div className="page page--defilante">
            <header className="frontispice">
              <div className="frontispice__symbole">
                <Symbole nom="chaudron" taille={44} />
              </div>
              <h1 className="frontispice__titre">Grimoire de recettes</h1>
              <p className="frontispice__sous-titre">{SOUS_TITRES[mode]}</p>
              <Ornement />
            </header>

            <form className="formulaire" onSubmit={valider}>
              <label className="champ">
                <span>E-mail</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {mode !== 'oubli' && (
                <ChampMotDePasse
                  libelle="Mot de passe"
                  valeur={motDePasse}
                  surChangement={setMotDePasse}
                  nouveau={mode === 'inscription'}
                />
              )}
              {mode === 'connexion' && (
                <button type="button" className="bouton bouton--lien bouton--discret" onClick={() => changerMode('oubli')}>
                  Mot de passe oublié ?
                </button>
              )}

              {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
              {info && <p className="message" role="status">{info}</p>}

              <button type="submit" className="bouton bouton--principal" disabled={enCours}>
                {mode === 'connexion' ? 'Se connecter' : mode === 'inscription' ? 'Créer mon compte' : 'Recevoir le lien'}
              </button>
              {mode !== 'oubli' && (
                <button type="button" className="bouton" onClick={avecGoogle}>
                  Continuer avec Google
                </button>
              )}
              <button
                type="button"
                className="bouton bouton--lien"
                onClick={() => changerMode(mode === 'connexion' ? 'inscription' : 'connexion')}
              >
                {mode === 'connexion' ? 'Pas encore de compte ? En créer un' : 'Retour à la connexion'}
              </button>
              <button type="button" className="bouton bouton--lien bouton--discret" onClick={() => setConfidentialite(true)}>
                Confidentialité et données personnelles
              </button>
            </form>
          </div>
        </div>
      </div>
      {confidentialite && <Confidentialite surFermer={() => setConfidentialite(false)} />}
    </main>
  );
}
