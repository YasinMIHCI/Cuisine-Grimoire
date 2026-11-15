import { livreFictif, recettesFictives } from './donnees/donneesFictives';
import { LivreOuvert } from './livre/LivreOuvert';

/**
 * Racine de l'application.
 * Pour l'instant : un seul livre, avec des données fictives.
 */
export function App() {
  return (
    <div className="table-cuir">
      <LivreOuvert livre={livreFictif} recettes={recettesFictives} />
    </div>
  );
}
