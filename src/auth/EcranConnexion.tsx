import { useState, type FormEvent } from 'react';
import { supabase } from '../donnees/supabase';
import { Ornement } from '../composants/Ornement';
import { Symbole } from '../composants/Symbole';
import { adresseDeRetour } from './session';

/** Traduit les messages d'erreur de Supabase. */
function traduire(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered/i.test(message)) return 'Un compte existe déjà avec cet e-mail.';
  if (/email not confirmed/i.test(message)) return 'Confirmez d’abord votre e-mail (lien reçu par courrier).';
  if (/at least 6 characters/i.test(message)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives : réessayez dans quelques minutes.';
  if (/failed to fetch|network/i.test(message)) return 'Pas de connexion à internet.';
  return message;
}

/** Écran de connexion : e-mail + mot de passe, ou compte Google. */
export function EcranConnexion() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const valider = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!supabase) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    if (mode === 'connexion') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
      if (error) setErreur(traduire(error.message));
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { emailRedirectTo: adresseDeRetour() },
      });
      if (error) setErreur(traduire(error.message));
      // Selon le réglage Supabase, il faut confirmer son e-mail avant d'être connecté
      else if (!data.session) setInfo('Compte créé ! Ouvrez le lien reçu par e-mail pour le confirmer.');
    }
    setEnCours(false);
  };

  const avecGoogle = async () => {
    if (!supabase) return;
    setErreur(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: adresseDeRetour() },
    });
    if (error) setErreur(traduire(error.message));
  };

  return (
    <div className="cadre-livre">
      <div className="feuille">
        <div className="feuille__recto parchemin">
          <div className="page page--defilante">
            <header className="frontispice">
              <div className="frontispice__symbole">
                <Symbole nom="chaudron" taille={44} />
              </div>
              <h1 className="frontispice__titre">Grimoire de recettes</h1>
              <p className="frontispice__sous-titre">
                {mode === 'connexion' ? 'Ouvrez votre bibliothèque' : 'Créez votre bibliothèque'}
              </p>
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
              <label className="champ">
                <span>Mot de passe</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                />
              </label>

              {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
              {info && <p className="message" role="status">{info}</p>}

              <button type="submit" className="bouton bouton--principal" disabled={enCours}>
                {mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
              </button>
              <button type="button" className="bouton" onClick={avecGoogle}>
                Continuer avec Google
              </button>
              <button
                type="button"
                className="bouton bouton--lien"
                onClick={() => {
                  setMode(mode === 'connexion' ? 'inscription' : 'connexion');
                  setErreur(null);
                  setInfo(null);
                }}
              >
                {mode === 'connexion' ? 'Pas encore de compte ? En créer un' : 'Déjà un compte ? Se connecter'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
