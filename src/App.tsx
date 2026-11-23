import { useState } from 'react';
import { EcranConnexion } from './auth/EcranConnexion';
import { FournisseurSession, useSession } from './auth/session';
import { livreParDefaut } from './donnees/donneesFictives';
import { Intro } from './intro/Intro';
import { Bibliotheque, CLE_DERNIER_LIVRE, PageAttente } from './bibliotheque/Bibliotheque';
import { CLE_INVITATION } from './amis/EcranAmis';
import type { ApparenceLivre } from './types';
import { Dialogues } from './composants/Dialogues';

/**
 * Lien d'invitation (…/?invitation=CODE) : on garde le code de côté, le temps
 * de se connecter si besoin, et on le retire de l'adresse affichée.
 */
function retenirInvitation() {
  const parametres = new URLSearchParams(window.location.search);
  const code = parametres.get('invitation');
  if (!code) return;
  try {
    localStorage.setItem(CLE_INVITATION, code);
  } catch {
    // stockage indisponible : l'invitation sera perdue
  }
  parametres.delete('invitation');
  const reste = parametres.toString();
  window.history.replaceState(null, '', window.location.pathname + (reste ? `?${reste}` : '') + window.location.hash);
}
retenirInvitation();

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
  // L'intro est jouée à chaque lancement, par-dessus l'appli déjà prête
  const [introEnCours, setIntroEnCours] = useState(true);
  const [livreIntro] = useState(lireDernierLivre);

  return (
    <div className="table-cuir">
      {session.statut === 'chargement' && <PageAttente />}
      {session.statut === 'deconnecte' && <EcranConnexion />}
      {/* `key` : en changeant de compte, on repart de données vierges */}
      {session.statut === 'connecte' && <Bibliotheque key={session.uid} uid={session.uid} />}
      <Dialogues />
      {introEnCours && <Intro livre={livreIntro} miniature={livreIntro.miniature} surFin={() => setIntroEnCours(false)} />}
    </div>
  );
}
