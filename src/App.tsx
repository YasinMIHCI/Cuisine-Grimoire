import { useState } from 'react';
import { EcranConnexion } from './auth/EcranConnexion';
import { FournisseurSession, useSession } from './auth/session';
import { livreParDefaut } from './donnees/donneesFictives';
import { Intro } from './intro/Intro';
import { Bibliotheque, CLE_DERNIER_LIVRE, PageAttente } from './livre/Bibliotheque';
import type { ApparenceLivre } from './types';

/** Apparence du dernier livre ouvert, mémorisée sur l'appareil. */
function lireDernierLivre(): ApparenceLivre {
  try {
    const memorise = localStorage.getItem(CLE_DERNIER_LIVRE);
    if (memorise) return { ...livreParDefaut, ...(JSON.parse(memorise) as Partial<ApparenceLivre>) };
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
      {introEnCours && <Intro livre={livreIntro} surFin={() => setIntroEnCours(false)} />}
    </div>
  );
}
