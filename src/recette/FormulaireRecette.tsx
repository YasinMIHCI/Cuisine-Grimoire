import { useState, type FormEvent } from 'react';
import { CATEGORIES, SYMBOLE_PAR_CATEGORIE, type Categorie, type Recette } from '../types';
import { ChoixPhoto } from '../composants/ChoixPhoto';
import { ImageCollee } from '../composants/ImageCollee';
import { Ornement } from '../composants/Ornement';
import { useDepot, useEtatDepot } from '../donnees/contexte';
import { confirmer } from '../composants/Dialogues';

interface Props {
  /** Recette à modifier, ou null pour en créer une nouvelle. */
  recette: Recette | null;
  /** Livre dans lequel ranger une nouvelle recette. */
  livreId: string;
  /** Appelé après l'enregistrement ou l'abandon. */
  surTermine: () => void;
  /** Appelé quand la recette a quitté ce livre (supprimée ou déplacée). */
  surPartie: () => void;
}

// Dans le formulaire, tout est du texte : on convertit à l'enregistrement.
interface LigneIngredient {
  quantite: string;
  unite: string;
  nom: string;
}
interface LigneEtape {
  texte: string;
  image?: string;
}

const enTexte = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
const enNombre = (texte: string) => {
  const n = parseFloat(texte.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Formulaire de création / modification d'une recette, dans le style du grimoire. */
export function FormulaireRecette({ recette, livreId, surTermine, surPartie }: Props) {
  const depot = useDepot();
  const { livres } = useEtatDepot();
  /** Livre où ranger la recette : le changer la déplace à l'enregistrement. */
  const [livreChoisi, setLivreChoisi] = useState(recette?.livreId ?? livreId);
  const [livreCopie, setLivreCopie] = useState('');
  const [infoCopie, setInfoCopie] = useState<string | null>(null);
  const [titre, setTitre] = useState(recette?.titre ?? '');
  const [categorie, setCategorie] = useState<Categorie>(recette?.categorie ?? 'Plats');
  const [preparation, setPreparation] = useState(recette ? String(recette.tempsPreparation) : '');
  const [cuisson, setCuisson] = useState(recette ? String(recette.tempsCuisson) : '');
  const [portions, setPortions] = useState(recette ? String(recette.portions) : '4');
  const [ingredients, setIngredients] = useState<LigneIngredient[]>(
    recette?.ingredients.map((i) => ({ quantite: enTexte(i.quantite), unite: i.unite, nom: i.nom })) ?? [
      { quantite: '', unite: '', nom: '' },
    ],
  );
  const [etapes, setEtapes] = useState<LigneEtape[]>(recette?.etapes.map((e) => ({ ...e })) ?? [{ texte: '' }]);
  const [notes, setNotes] = useState(recette?.notes ?? '');
  const [photoPrincipale, setPhotoPrincipale] = useState<string | null>(recette?.photoPrincipale ?? null);
  const [galerie, setGalerie] = useState<string[]>(recette?.galerie ?? []);
  const [enCours, setEnCours] = useState(false);

  /** Remplace l'élément i d'une liste par une version modifiée. */
  const modifier = <T,>(liste: T[], i: number, changement: Partial<T>) =>
    liste.map((element, j) => (j === i ? { ...element, ...changement } : element));

  const enregistrer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!titre.trim()) return;
    setEnCours(true);
    await depot.enregistrerRecette({
      // Pour une modification, on repart de la recette existante (id, dates, favori…)
      ...(recette ?? { favori: false }),
      livreId: livreChoisi,
      titre: titre.trim(),
      categorie,
      // On garde le symbole d'origine tant que la catégorie n'a pas changé
      symbole: recette && recette.categorie === categorie ? recette.symbole : SYMBOLE_PAR_CATEGORIE[categorie],
      tempsPreparation: Math.max(0, Math.round(enNombre(preparation) ?? 0)),
      tempsCuisson: Math.max(0, Math.round(enNombre(cuisson) ?? 0)),
      portions: Math.max(1, Math.round(enNombre(portions) ?? 1)),
      // Les lignes laissées vides sont ignorées
      ingredients: ingredients
        .filter((i) => i.nom.trim())
        .map((i) => ({ quantite: enNombre(i.quantite), unite: i.unite.trim(), nom: i.nom.trim() })),
      etapes: etapes
        .filter((e) => e.texte.trim() || e.image)
        .map((e) => ({ texte: e.texte.trim(), ...(e.image ? { image: e.image } : {}) })),
      notes: notes.trim(),
      photoPrincipale,
      galerie,
    });
    // Déplacée dans un autre livre : elle n'est plus dans celui-ci
    if (recette && livreChoisi !== recette.livreId) surPartie();
    else surTermine();
  };

  const copier = async () => {
    if (!recette || !livreCopie) return;
    setEnCours(true);
    await depot.copierRecette(recette.id, livreCopie);
    setEnCours(false);
    setInfoCopie(`Copie rangée dans « ${livres.find((l) => l.id === livreCopie)?.titre} ».`);
  };

  const supprimer = async () => {
    if (!recette || !(await confirmer(`Supprimer définitivement « ${recette.titre} » ?`, { oui: 'Supprimer', danger: true }))) return;
    await depot.supprimerRecette(recette.id);
    surPartie();
  };

  return (
    <form className="page page--defilante formulaire" onSubmit={enregistrer}>
      <header className="frontispice">
        <h1 className="recette__titre">{recette ? 'Modifier la recette' : 'Nouvelle recette'}</h1>
        <Ornement />
      </header>

      <label className="champ">
        <span>Titre</span>
        <input type="text" required value={titre} onChange={(e) => setTitre(e.target.value)} />
      </label>

      <label className="champ">
        <span>Catégorie</span>
        <select value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="champs-en-ligne">
        <label className="champ">
          <span>Préparation (min)</span>
          <input type="text" inputMode="numeric" value={preparation} onChange={(e) => setPreparation(e.target.value)} />
        </label>
        <label className="champ">
          <span>Cuisson (min)</span>
          <input type="text" inputMode="numeric" value={cuisson} onChange={(e) => setCuisson(e.target.value)} />
        </label>
        <label className="champ">
          <span>Portions</span>
          <input type="text" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
        </label>
      </div>

      {/* ------------------------------------------------ Photo principale */}
      <h2 className="recette__section">Photo principale</h2>
      {photoPrincipale ? (
        <div className="photo-editable">
          <ImageCollee id={photoPrincipale} format="etape" />
          <button type="button" className="bouton bouton--petit" onClick={() => setPhotoPrincipale(null)}>
            Retirer
          </button>
        </div>
      ) : (
        <ChoixPhoto surAjout={setPhotoPrincipale} />
      )}

      {/* ----------------------------------------------------- Ingrédients */}
      <h2 className="recette__section">Ingrédients</h2>
      {ingredients.map((ingredient, i) => (
        <div key={i} className="ligne-ingredient">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Qté"
            aria-label="Quantité"
            value={ingredient.quantite}
            onChange={(e) => setIngredients(modifier(ingredients, i, { quantite: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Unité"
            aria-label="Unité"
            value={ingredient.unite}
            onChange={(e) => setIngredients(modifier(ingredients, i, { unite: e.target.value }))}
          />
          <input
            type="text"
            placeholder="Ingrédient"
            aria-label="Nom de l’ingrédient"
            value={ingredient.nom}
            onChange={(e) => setIngredients(modifier(ingredients, i, { nom: e.target.value }))}
          />
          <button
            type="button"
            className="bouton-retirer"
            aria-label="Retirer cet ingrédient"
            onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="bouton bouton--petit"
        onClick={() => setIngredients([...ingredients, { quantite: '', unite: '', nom: '' }])}
      >
        + Ajouter un ingrédient
      </button>

      {/* ---------------------------------------------------------- Étapes */}
      <h2 className="recette__section">Préparation</h2>
      {etapes.map((etape, i) => (
        <div key={i} className="ligne-etape">
          <div className="ligne-etape__entete">
            <span className="etape__numero">{i + 1}</span>
            <button
              type="button"
              className="bouton-retirer"
              aria-label="Retirer cette étape"
              onClick={() => setEtapes(etapes.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
          <textarea
            rows={3}
            placeholder="Décrivez cette étape…"
            aria-label={`Étape ${i + 1}`}
            value={etape.texte}
            onChange={(e) => setEtapes(modifier(etapes, i, { texte: e.target.value }))}
          />
          {etape.image ? (
            <div className="photo-editable">
              <ImageCollee id={etape.image} format="etape" />
              <button
                type="button"
                className="bouton bouton--petit"
                onClick={() => setEtapes(modifier(etapes, i, { image: undefined }))}
              >
                Retirer
              </button>
            </div>
          ) : (
            <ChoixPhoto surAjout={(image) => setEtapes((liste) => modifier(liste, i, { image }))} />
          )}
        </div>
      ))}
      <button type="button" className="bouton bouton--petit" onClick={() => setEtapes([...etapes, { texte: '' }])}>
        + Ajouter une étape
      </button>

      {/* --------------------------------------------------------- Galerie */}
      <h2 className="recette__section">Galerie de photos</h2>
      {galerie.length > 0 && (
        <div className="galerie-editable">
          {galerie.map((id) => (
            <div key={id} className="photo-editable">
              <ImageCollee id={id} format="galerie" />
              <button
                type="button"
                className="bouton bouton--petit"
                onClick={() => setGalerie(galerie.filter((g) => g !== id))}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
      <ChoixPhoto multiple surAjout={(id) => setGalerie((liste) => [...liste, id])} />

      {/* ----------------------------------------------------------- Notes */}
      <h2 className="recette__section">Notes personnelles</h2>
      <textarea rows={3} aria-label="Notes personnelles" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {/* ------------------------------------ Rangement (s'il y a plusieurs livres) */}
      {livres.length > 1 && (
        <>
          <h2 className="recette__section">Rangement</h2>
          <label className="champ">
            <span>{recette ? 'Livre (en changer déplace la recette)' : 'Livre'}</span>
            <select value={livreChoisi} onChange={(e) => setLivreChoisi(e.target.value)}>
              {livres.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.titre}
                </option>
              ))}
            </select>
          </label>
          {recette && (
            <div className="champ">
              <span>Copier la recette dans un autre livre</span>
              <div className="ligne-copie">
                <select value={livreCopie} onChange={(e) => setLivreCopie(e.target.value)} aria-label="Livre de destination">
                  <option value="">Choisir un livre…</option>
                  {livres.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.titre}
                    </option>
                  ))}
                </select>
                <button type="button" className="bouton bouton--petit" disabled={!livreCopie || enCours} onClick={copier}>
                  Copier
                </button>
              </div>
              {infoCopie && <p className="message" role="status">{infoCopie}</p>}
            </div>
          )}
        </>
      )}

      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal" disabled={enCours}>
          Enregistrer
        </button>
        <button type="button" className="bouton" onClick={surTermine}>
          Annuler
        </button>
        {recette && (
          <button type="button" className="bouton bouton--danger" onClick={supprimer}>
            Supprimer la recette
          </button>
        )}
      </div>
    </form>
  );
}
