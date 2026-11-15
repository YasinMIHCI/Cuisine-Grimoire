import { useState } from 'react';
import { livreFictif, recettesFictives } from './donnees/donneesFictives';
import { Intro } from './intro/Intro';
import { LivreOuvert } from './livre/LivreOuvert';

/**
 * Racine de l'application.
 * Pour l'instant : un seul livre, avec des données fictives.
 */
export function App() {
  // L'intro est jouée à chaque lancement, par-dessus l'appli déjà prête
  const [introEnCours, setIntroEnCours] = useState(true);

  return (
    <div className="table-cuir">
      <LivreOuvert livre={livreFictif} recettes={recettesFictives} />
      {introEnCours && <Intro livre={livreFictif} surFin={() => setIntroEnCours(false)} />}
    </div>
  );
}
