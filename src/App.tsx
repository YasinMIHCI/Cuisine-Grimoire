import { useState } from 'react';
import { livreFictif, recettesFictives } from './donnees/donneesFictives';
import { Sommaire } from './composants/Sommaire';
import { PageRecette } from './composants/PageRecette';

/**
 * Racine de l'application.
 * Étape (a) : un seul livre, données fictives, navigation sommaire ↔ recette.
 */
export function App() {
  // Identifiant de la recette ouverte (null = on est sur le sommaire)
  const [recetteOuverte, setRecetteOuverte] = useState<string | null>(null);
  const recette = recettesFictives.find((r) => r.id === recetteOuverte);

  return (
    <div className="table-cuir">
      <main className="parchemin">
        {recette ? (
          <PageRecette recette={recette} surRetourSommaire={() => setRecetteOuverte(null)} />
        ) : (
          <Sommaire
            livre={livreFictif}
            recettes={recettesFictives}
            surOuvrirRecette={setRecetteOuverte}
          />
        )}
      </main>
    </div>
  );
}
