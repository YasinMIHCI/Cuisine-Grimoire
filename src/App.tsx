import { lazy, Suspense, useState } from 'react';
import { EcranConnexion } from './auth/EcranConnexion';
import { EcranNouveauMotDePasse } from './auth/EcranNouveauMotDePasse';
import { FournisseurSession, useMotDePasseChange, useSession } from './auth/session';
import { introAJouer } from './intro/reglage';
import { livreParDefaut } from './donnees/donneesFictives';
import { Bibliotheque, CLE_DERNIER_LIVRE, PageAttente } from './bibliotheque/Bibliotheque';
import { CLE_INVITATION } from './amis/cles';
import type { ApparenceLivre } from './types';
import { Dialogues } from './composants/Dialogues';

// L'intro (et son moteur d'animation) n'est chargée que si elle est jouée
const Intro = lazy(() => import('./intro/Intro').then((m) => ({ default: m.Intro })));

/**
 * Lien d'invitation (…/?invitation=CODE) : on garde le code de côté, le temps
 * de se connecter si besoin, et on le retire de l'adresse affichée.
 */
function retenirInvitation(): boolean {
  const parametres = new URLSearchParams(window.location.search);
  const code = parametres.get('invitation');
  if (!code) return false;
  try {
    localStorage.setItem(CLE_INVITATION, code);
  } catch {
    // stockage indisponible : l'invitation sera perdue
  }
  parametres.delete('invitation');
  const reste = parametres.toString();
  window.history.replaceState(null, '', window.location.pathname + (reste ? `?${reste}` : '') + window.location.hash);
  return true;
}
const arriveeParInvitation = retenirInvitation();

/** Apparence du dernier livre ouvert, mémorisée sur l'appareil. */
function lireDernierLivre(): ApparenceLivre & { miniature?: string | null } {
  try {
    const memorise = localStorage.getItem(CLE_DERNIER_LIVRE);
    if (memorise) return { ...livreParDefaut, ...JSON.parse(memorise) };
  } catch {
    // stockage indisponible ou illisible : on garde le livre par défaut
  }
  return livreParDefaut;
}

/** Racine de l'application. */
export function App() {
  return (
    <FournisseurSession>
      <Contenu />
    </FournisseurSession>
  );
}

function Contenu() {
  const session = useSession();
  const motDePasseChange = useMotDePasseChange();
  // L'intro est jouée par-dessus l'appli déjà prête (une fois par jour par défaut : voir le panneau Compte)
  const [introEnCours, setIntroEnCours] = useState(() => introAJouer(arriveeParInvitation));
  const [livreIntro] = useState(lireDernierLivre);

  return (
    <div className="table-cuir">
      {session.statut === 'chargement' && <PageAttente />}
      {session.statut === 'deconnecte' && <EcranConnexion />}
      {/* `key` : en changeant de compte, on repart de données vierges */}
      {session.statut === 'connecte' && session.motDePasseAChanger && <EcranNouveauMotDePasse surTermine={motDePasseChange} />}
      {session.statut === 'connecte' && !session.motDePasseAChanger && <Bibliotheque key={session.uid} uid={session.uid} />}
      <Dialogues />
      {introEnCours && (
        <Suspense fallback={<div className="intro" aria-hidden="true" />}>
          <Intro livre={livreIntro} miniature={livreIntro.miniature} surFin={() => setIntroEnCours(false)} />
        </Suspense>
      )}
    </div>
  );
}
