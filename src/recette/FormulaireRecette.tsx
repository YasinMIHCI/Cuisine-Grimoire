import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CATEGORIES, SYMBOLE_PAR_CATEGORIE, type Categorie, type Ingredient, type Recette } from '../types';
import { ChoixPhoto } from '../composants/ChoixPhoto';
import { ImageCollee } from '../composants/ImageCollee';
import { Ornement } from '../composants/Ornement';
import { confirmer, demanderTexte, informer } from '../composants/Dialogues';
import { useDepot, useEtatDepot } from '../donnees/contexte';
import { lireListeIngredients, lireQuantite } from '../utilitaires/quantites';

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
// `cle` identifie une ligne (pour React) même quand on la déplace ou en retire une autre.
interface LigneIngredient {
  cle: string;
  quantite: string;
  unite: string;
  nom: string;
}
interface LigneEtape {
  cle: string;
  texte: string;
  image?: string;
}

/** Tout ce que contient le formulaire (et ce qu'on garde en brouillon). */
interface Champs {
  livreChoisi: string;
  titre: string;
  categorie: Categorie;
  preparation: string;
  cuisson: string;
  portions: string;
  ingredients: LigneIngredient[];
  etapes: LigneEtape[];
  notes: string;
  photoPrincipale: string | null;
  galerie: string[];
}

const LIMITES = { titre: 200, notes: 10000, portions: 999, minutes: 100000 };

const nouvelleCle = () => crypto.randomUUID();
const enTexte = (n: number | null) => (n === null ? '' : String(Math.round(n * 1000) / 1000).replace('.', ','));
const ligneVide = (): LigneIngredient => ({ cle: nouvelleCle(), quantite: '', unite: '', nom: '' });
const versLigne = (i: Ingredient): LigneIngredient => ({ cle: nouvelleCle(), quantite: enTexte(i.quantite), unite: i.unite, nom: i.nom });

/** Nombre entier borné, à partir d'un texte (« 1 1/2 » et « 2,5 » compris). */
const entier = (texte: string, min: number, max: number, defaut: number) => {
  const n = lireQuantite(texte);
  return n === null ? defaut : Math.min(max, Math.max(min, Math.round(n)));
};

function champsInitiaux(recette: Recette | null, livreId: string): Champs {
  return {
    livreChoisi: recette?.livreId ?? livreId,
    titre: recette?.titre ?? '',
    categorie: recette?.categorie ?? 'Plats',
    preparation: recette ? String(recette.tempsPreparation) : '',
    cuisson: recette ? String(recette.tempsCuisson) : '',
    portions: recette ? String(recette.portions) : '4',
    ingredients: recette?.ingredients.map(versLigne) ?? [ligneVide()],
    etapes: recette?.etapes.map((e) => ({ cle: nouvelleCle(), ...e })) ?? [{ cle: nouvelleCle(), texte: '' }],
    notes: recette?.notes ?? '',
    photoPrincipale: recette?.photoPrincipale ?? null,
    galerie: recette?.galerie ?? [],
  };
}

/** Le contenu, sans les clés de lignes : sert à savoir si quelque chose a changé. */
const empreinte = (c: Champs) =>
  JSON.stringify({
    ...c,
    ingredients: c.ingredients.map(({ quantite, unite, nom }) => [quantite, unite, nom]),
    etapes: c.etapes.map(({ texte, image }) => [texte, image ?? null]),
  });

/** Images utilisées par un état du formulaire. */
const imagesDuFormulaire = (c: Champs) => [
  ...(c.photoPrincipale ? [c.photoPrincipale] : []),
  ...c.galerie,
  ...c.etapes.flatMap((e) => (e.image ? [e.image] : [])),
];

// --- Brouillon : le formulaire est gardé sur l'appareil tant qu'il n'est pas
// enregistré (geste retour par erreur, appli fermée, téléphone qui sonne…).
const cleBrouillon = (recette: Recette | null, livreId: string) =>
  `grimoire:brouillon:${recette ? recette.id : `nouvelle:${livreId}`}`;

function lireBrouillon(cle: string): Champs | null {
  try {
    const texte = localStorage.getItem(cle);
    return texte ? (JSON.parse(texte) as Champs) : null;
  } catch {
    return null;
  }
}
function ecrireBrouillon(cle: string, champs: Champs | null) {
  try {
    if (champs) localStorage.setItem(cle, JSON.stringify(champs));
    else localStorage.removeItem(cle);
  } catch {
    // stockage plein ou indisponible : pas de brouillon
  }
}

/** Déplace l'élément i d'une liste d'un cran (pas = -1 : vers le haut). */
function deplacer<T>(liste: T[], i: number, pas: -1 | 1): T[] {
  const j = i + pas;
  if (j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

/** Formulaire de création / modification d'une recette, dans le style du grimoire. */
export function FormulaireRecette({ recette, livreId, surTermine, surPartie }: Props) {
  const depot = useDepot();
  const { livres } = useEtatDepot();
  const cle = cleBrouillon(recette, livreId);
  const [origine] = useState(() => champsInitiaux(recette, livreId));
  const [brouillonRestaure] = useState(() => lireBrouillon(cle));
  const [champs, setChamps] = useState<Champs>(brouillonRestaure ?? origine);
  const [avisBrouillon, setAvisBrouillon] = useState(brouillonRestaure !== null);
  const [livreCopie, setLivreCopie] = useState('');
  const [infoCopie, setInfoCopie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Photos ajoutées pendant cette séance (à effacer si on abandonne). */
  const ajoutees = useRef<string[]>([]);

  const modifie = useMemo(() => empreinte(champs) !== empreinte(origine), [champs, origine]);
  const maj = (changement: Partial<Champs>) => setChamps((c) => ({ ...c, ...changement }));
  const ajouterImage = (id: string) => ajoutees.current.push(id);

  // Le brouillon suit chaque changement (et disparaît si on revient à l'original)
  const termine = useRef(false);
  useEffect(() => {
    if (termine.current) return;
    const minuterie = setTimeout(() => ecrireBrouillon(cle, modifie ? champs : null), 400);
    return () => clearTimeout(minuterie);
  }, [cle, champs, modifie]);
  // En quittant l'écran sans enregistrer ni annuler (geste retour…), le brouillon est écrit tout de suite
  const dernier = useRef({ champs, modifie });
  dernier.current = { champs, modifie };
  useEffect(
    () => () => {
      if (!termine.current && dernier.current.modifie) ecrireBrouillon(cle, dernier.current.champs);
    },
    [cle],
  );

  /** Oublie le brouillon et les photos qui n'auront servi à rien. */
  const abandonner = async (gardees: Champs | null) => {
    termine.current = true;
    ecrireBrouillon(cle, null);
    const utiles = new Set(gardees ? imagesDuFormulaire(gardees) : []);
    const candidates = [...ajoutees.current, ...(brouillonRestaure ? imagesDuFormulaire(brouillonRestaure) : [])];
    await depot.abandonnerImages(candidates.filter((id) => !utiles.has(id)));
  };

  const repartirDeLOriginal = async () => {
    const actuel = champs;
    setChamps(origine);
    setAvisBrouillon(false);
    ecrireBrouillon(cle, null);
    const utiles = new Set(imagesDuFormulaire(origine));
    await depot.abandonnerImages(imagesDuFormulaire(actuel).filter((id) => !utiles.has(id)));
  };

  const annuler = async () => {
    if (modifie && !(await confirmer('Abandonner les modifications de cette recette ?', { oui: 'Abandonner', non: 'Continuer', danger: true }))) {
      return;
    }
    await abandonner(null);
    surTermine();
  };

  const enregistrer = async (evenement: FormEvent) => {
    evenement.preventDefault();
    const titre = champs.titre.trim();
    if (!titre) return;
    setEnCours(true);
    setErreur(null);
    try {
      await depot.enregistrerRecette({
        // Pour une modification, on repart de la recette existante (id, dates, favori…)
        ...(recette ?? { favori: false }),
        livreId: champs.livreChoisi,
        titre: titre.slice(0, LIMITES.titre),
        categorie: champs.categorie,
        // On garde le symbole d'origine tant que la catégorie n'a pas changé
        symbole: recette && recette.categorie === champs.categorie ? recette.symbole : SYMBOLE_PAR_CATEGORIE[champs.categorie],
        tempsPreparation: entier(champs.preparation, 0, LIMITES.minutes, 0),
        tempsCuisson: entier(champs.cuisson, 0, LIMITES.minutes, 0),
        portions: entier(champs.portions, 1, LIMITES.portions, 1),
        // Les lignes laissées vides sont ignorées. Une quantité qui n'est pas un
        // nombre (« quelques ») n'est pas perdue : elle rejoint le nom.
        ingredients: champs.ingredients
          .filter((i) => i.nom.trim() || i.quantite.trim())
          .map((i) => {
            const quantite = lireQuantite(i.quantite);
            const texteQuantite = quantite === null && i.quantite.trim() ? `${i.quantite.trim()} ` : '';
            return { quantite, unite: quantite === null ? '' : i.unite.trim(), nom: `${texteQuantite}${quantite === null && i.unite.trim() ? `${i.unite.trim()} ` : ''}${i.nom.trim()}`.trim() };
          }),
        etapes: champs.etapes
          .filter((e) => e.texte.trim() || e.image)
          .map((e) => ({ texte: e.texte.trim(), ...(e.image ? { image: e.image } : {}) })),
        notes: champs.notes.trim().slice(0, LIMITES.notes),
        photoPrincipale: champs.photoPrincipale,
        galerie: champs.galerie,
      });
      await abandonner(champs);
      // Déplacée dans un autre livre : elle n'est plus dans celui-ci
      if (recette && champs.livreChoisi !== recette.livreId) surPartie();
      else surTermine();
    } catch (e) {
      setErreur(`Enregistrement impossible : ${(e as Error).message}`);
      setEnCours(false);
    }
  };

  const copier = async () => {
    if (!recette || !livreCopie) return;
    setEnCours(true);
    try {
      await depot.copierRecette(recette.id, livreCopie);
      setInfoCopie(`Copie rangée dans « ${livres.find((l) => l.id === livreCopie)?.titre} ».`);
    } catch (e) {
      setErreur(`Copie impossible : ${(e as Error).message}`);
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async () => {
    if (!recette || !(await confirmer(`Supprimer définitivement « ${recette.titre} » ?`, { oui: 'Supprimer', danger: true }))) return;
    await abandonner(null);
    await depot.supprimerRecette(recette.id);
    surPartie();
  };

  const collerIngredients = async () => {
    const texte = await demanderTexte('Collez la liste des ingrédients, un par ligne :', {
      multiligne: true,
      oui: 'Ajouter',
      aide: 'Exemple : « 200 g de farine », « 1/2 c. à café de sel », « 3 œufs ».',
    });
    if (!texte) return;
    const lus = lireListeIngredients(texte).map(versLigne);
    if (lus.length === 0) {
      await informer('Aucun ingrédient trouvé dans ce texte.');
      return;
    }
    // Les lignes encore vides sont remplacées par la liste collée
    setChamps((c) => ({ ...c, ingredients: [...c.ingredients.filter((i) => i.nom.trim() || i.quantite.trim()), ...lus] }));
  };

  const { ingredients, etapes, galerie } = champs;
  const majIngredient = (i: number, changement: Partial<LigneIngredient>) =>
    maj({ ingredients: ingredients.map((x, j) => (j === i ? { ...x, ...changement } : x)) });
  const majEtape = (i: number, changement: Partial<LigneEtape>) =>
    setChamps((c) => ({ ...c, etapes: c.etapes.map((x, j) => (j === i ? { ...x, ...changement } : x)) }));

  return (
    <form className="page page--defilante formulaire" onSubmit={enregistrer} aria-labelledby="titre-formulaire">
      <header className="frontispice">
        <h1 id="titre-formulaire" className="recette__titre">
          {recette ? 'Modifier la recette' : 'Nouvelle recette'}
        </h1>
        <Ornement />
      </header>

      {avisBrouillon && (
        <div className="avis" role="status">
          <p>Votre brouillon non enregistré a été retrouvé.</p>
          <div className="avis__actions">
            <button type="button" className="bouton bouton--petit" onClick={() => setAvisBrouillon(false)}>
              Continuer
            </button>
            <button type="button" className="bouton bouton--petit" onClick={() => void repartirDeLOriginal()}>
              {recette ? 'Repartir de la version enregistrée' : 'Repartir de zéro'}
            </button>
          </div>
        </div>
      )}

      <label className="champ">
        <span>Titre</span>
        <input type="text" required maxLength={LIMITES.titre} value={champs.titre} onChange={(e) => maj({ titre: e.target.value })} />
      </label>

      <label className="champ">
        <span>Catégorie</span>
        <select value={champs.categorie} onChange={(e) => maj({ categorie: e.target.value as Categorie })}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="champs-en-ligne">
        <label className="champ">
          <span>Préparation (min)</span>
          <input type="text" inputMode="numeric" maxLength={6} value={champs.preparation} onChange={(e) => maj({ preparation: e.target.value })} />
        </label>
        <label className="champ">
          <span>Cuisson (min)</span>
          <input type="text" inputMode="numeric" maxLength={6} value={champs.cuisson} onChange={(e) => maj({ cuisson: e.target.value })} />
        </label>
        <label className="champ">
          <span>Portions</span>
          <input type="text" inputMode="numeric" maxLength={3} value={champs.portions} onChange={(e) => maj({ portions: e.target.value })} />
        </label>
      </div>

      {/* ------------------------------------------------ Photo principale */}
      <h2 className="recette__section">Photo principale</h2>
      {champs.photoPrincipale ? (
        <div className="photo-editable">
          <ImageCollee id={champs.photoPrincipale} format="etape" />
          <button type="button" className="bouton bouton--petit" onClick={() => maj({ photoPrincipale: null })}>
            Retirer
          </button>
        </div>
      ) : (
        <ChoixPhoto
          surAjout={(id) => {
            ajouterImage(id);
            maj({ photoPrincipale: id });
          }}
        />
      )}

      {/* ----------------------------------------------------- Ingrédients */}
      <h2 className="recette__section">Ingrédients</h2>
      <p className="champ__aide">Quantités : 2, 2,5, 1/2 ou 1 1/2.</p>
      {ingredients.map((ingredient, i) => {
        const illisible = ingredient.quantite.trim() !== '' && lireQuantite(ingredient.quantite) === null;
        return (
          <div key={ingredient.cle} className="ligne-ingredient">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Qté"
              aria-label={`Quantité, ingrédient ${i + 1}`}
              aria-invalid={illisible || undefined}
              title={illisible ? 'Pas un nombre : ce texte sera ajouté au nom de l’ingrédient' : undefined}
              value={ingredient.quantite}
              onChange={(e) => majIngredient(i, { quantite: e.target.value })}
            />
            <input
              type="text"
              placeholder="Unité"
              aria-label={`Unité, ingrédient ${i + 1}`}
              maxLength={30}
              value={ingredient.unite}
              onChange={(e) => majIngredient(i, { unite: e.target.value })}
            />
            <input
              type="text"
              placeholder="Ingrédient"
              aria-label={`Nom, ingrédient ${i + 1}`}
              maxLength={200}
              value={ingredient.nom}
              onChange={(e) => majIngredient(i, { nom: e.target.value })}
            />
            <OutilsLigne
              nom={`l’ingrédient ${i + 1}`}
              premier={i === 0}
              dernier={i === ingredients.length - 1}
              surMonter={() => maj({ ingredients: deplacer(ingredients, i, -1) })}
              surDescendre={() => maj({ ingredients: deplacer(ingredients, i, 1) })}
              surRetirer={() => maj({ ingredients: ingredients.filter((_, j) => j !== i) })}
            />
          </div>
        );
      })}
      <div className="formulaire__ajouts">
        <button type="button" className="bouton bouton--petit" onClick={() => maj({ ingredients: [...ingredients, ligneVide()] })}>
          + Ajouter un ingrédient
        </button>
        <button type="button" className="bouton bouton--petit" onClick={() => void collerIngredients()}>
          Coller une liste
        </button>
      </div>

      {/* ---------------------------------------------------------- Étapes */}
      <h2 className="recette__section">Préparation</h2>
      {etapes.map((etape, i) => (
        <div key={etape.cle} className="ligne-etape">
          <div className="ligne-etape__entete">
            <span className="etape__numero">{i + 1}</span>
            <OutilsLigne
              nom={`l’étape ${i + 1}`}
              premier={i === 0}
              dernier={i === etapes.length - 1}
              surMonter={() => maj({ etapes: deplacer(etapes, i, -1) })}
              surDescendre={() => maj({ etapes: deplacer(etapes, i, 1) })}
              surRetirer={() => maj({ etapes: etapes.filter((_, j) => j !== i) })}
            />
          </div>
          <textarea
            rows={3}
            placeholder="Décrivez cette étape…"
            aria-label={`Étape ${i + 1}`}
            maxLength={5000}
            value={etape.texte}
            onChange={(e) => majEtape(i, { texte: e.target.value })}
          />
          {etape.image ? (
            <div className="photo-editable">
              <ImageCollee id={etape.image} format="etape" />
              <button type="button" className="bouton bouton--petit" onClick={() => majEtape(i, { image: undefined })}>
                Retirer
              </button>
            </div>
          ) : (
            <ChoixPhoto
              surAjout={(image) => {
                ajouterImage(image);
                majEtape(i, { image });
              }}
            />
          )}
        </div>
      ))}
      <button type="button" className="bouton bouton--petit" onClick={() => maj({ etapes: [...etapes, { cle: nouvelleCle(), texte: '' }] })}>
        + Ajouter une étape
      </button>

      {/* --------------------------------------------------------- Galerie */}
      <h2 className="recette__section">Galerie de photos</h2>
      {galerie.length > 0 && (
        <div className="galerie-editable">
          {galerie.map((id) => (
            <div key={id} className="photo-editable">
              <ImageCollee id={id} format="galerie" />
              <button type="button" className="bouton bouton--petit" onClick={() => maj({ galerie: galerie.filter((g) => g !== id) })}>
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
      <ChoixPhoto
        multiple
        surAjout={(id) => {
          ajouterImage(id);
          setChamps((c) => ({ ...c, galerie: [...c.galerie, id] }));
        }}
      />

      {/* ----------------------------------------------------------- Notes */}
      <h2 className="recette__section">Notes personnelles</h2>
      <textarea rows={3} aria-label="Notes personnelles" maxLength={LIMITES.notes} value={champs.notes} onChange={(e) => maj({ notes: e.target.value })} />

      {/* ------------------------------------ Rangement (s'il y a plusieurs livres) */}
      {livres.length > 1 && (
        <>
          <h2 className="recette__section">Rangement</h2>
          <label className="champ">
            <span>{recette ? 'Livre (en changer déplace la recette)' : 'Livre'}</span>
            <select value={champs.livreChoisi} onChange={(e) => maj({ livreChoisi: e.target.value })}>
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

      {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}

      <div className="formulaire__actions">
        <button type="submit" className="bouton bouton--principal" disabled={enCours}>
          Enregistrer
        </button>
        <button type="button" className="bouton" onClick={() => void annuler()}>
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

/** Boutons d'une ligne : monter, descendre, retirer. */
function OutilsLigne(props: {
  nom: string;
  premier: boolean;
  dernier: boolean;
  surMonter: () => void;
  surDescendre: () => void;
  surRetirer: () => void;
}) {
  return (
    <span className="outils-ligne">
      <button type="button" className="bouton-ligne" aria-label={`Monter ${props.nom}`} disabled={props.premier} onClick={props.surMonter}>
        ↑
      </button>
      <button type="button" className="bouton-ligne" aria-label={`Descendre ${props.nom}`} disabled={props.dernier} onClick={props.surDescendre}>
        ↓
      </button>
      <button type="button" className="bouton-ligne bouton-ligne--retirer" aria-label={`Retirer ${props.nom}`} onClick={props.surRetirer}>
        ×
      </button>
    </span>
  );
}
