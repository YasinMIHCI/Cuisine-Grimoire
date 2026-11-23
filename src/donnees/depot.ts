// Le « dépôt » : source unique des données de l'appli (livres, recettes, images).
//
// Principe « local d'abord » :
//  - toute lecture et toute écriture passent par la base locale (IndexedDB),
//    l'appli fonctionne donc hors ligne ;
//  - chaque modification est marquée « à synchroniser » puis envoyée à Supabase
//    dès que le réseau est là ;
//  - en cas de conflit entre deux appareils, la modification la plus récente
//    l'emporte (champ modifieLe).
import type { ContenuEnvoi, Livre, Recette, Synchronisable } from '../types';
import { ecrire, effacer, lire, lireTout, ouvrirBase, type ImageLocale, type Magasin } from './baseLocale';
import { livreFictif, recettesFictives } from './donneesFictives';
import { compresserImage } from './images';
import { SEAU_IMAGES, supabase, UID_LOCAL } from './supabase';

export type EtatSynchro = 'locale' | 'en-cours' | 'a-jour' | 'hors-ligne' | 'erreur';

export interface EtatDepot {
  /** Livres et recettes non supprimés. */
  livres: Livre[];
  recettes: Recette[];
  synchro: EtatSynchro;
  /** Détail de la dernière erreur de synchronisation, le cas échéant. */
  erreur?: string;
}

// --- Conversion entre les objets de l'appli et les lignes des tables ---------

/* eslint-disable @typescript-eslint/no-explicit-any */
const livreVersLigne = (l: Livre) => ({
  id: l.id,
  proprietaire_id: l.proprietaireId,
  titre: l.titre,
  couleur_cuir: l.couleurCuir,
  symbole: l.symbole,
  image_couverture: l.imageCouverture ?? null,
  transmis_par: l.transmisPar ?? null,
  cree_le: l.creeLe,
  modifie_le: l.modifieLe,
  supprime_le: l.supprimeLe ?? null,
});

const ligneVersLivre = (x: any): Livre => ({
  id: x.id,
  proprietaireId: x.proprietaire_id,
  titre: x.titre,
  couleurCuir: x.couleur_cuir,
  symbole: x.symbole,
  imageCouverture: x.image_couverture ?? null,
  transmisPar: x.transmis_par ?? null,
  creeLe: x.cree_le,
  modifieLe: x.modifie_le,
  supprimeLe: x.supprime_le,
});

const recetteVersLigne = (r: Recette) => ({
  id: r.id,
  proprietaire_id: r.proprietaireId,
  livre_id: r.livreId,
  titre: r.titre,
  categorie: r.categorie,
  temps_preparation: r.tempsPreparation,
  temps_cuisson: r.tempsCuisson,
  portions: r.portions,
  ingredients: r.ingredients,
  etapes: r.etapes,
  notes: r.notes,
  favori: r.favori,
  symbole: r.symbole,
  photo_principale: r.photoPrincipale ?? null,
  galerie: r.galerie,
  origine_id: r.origineId,
  transmis_par: r.transmisPar ?? null,
  cree_le: r.creeLe,
  modifie_le: r.modifieLe,
  supprime_le: r.supprimeLe ?? null,
});

const ligneVersRecette = (x: any): Recette => ({
  id: x.id,
  proprietaireId: x.proprietaire_id,
  livreId: x.livre_id,
  titre: x.titre,
  categorie: x.categorie,
  tempsPreparation: x.temps_preparation,
  tempsCuisson: x.temps_cuisson,
  portions: x.portions,
  ingredients: x.ingredients ?? [],
  etapes: x.etapes ?? [],
  notes: x.notes ?? '',
  favori: x.favori,
  symbole: x.symbole,
  photoPrincipale: x.photo_principale,
  galerie: x.galerie ?? [],
  origineId: x.origine_id ?? x.id,
  transmisPar: x.transmis_par ?? null,
  creeLe: x.cree_le,
  modifieLe: x.modifie_le,
  supprimeLe: x.supprime_le,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const maintenant = () => new Date().toISOString();
const dateDe = (iso: string) => Date.parse(iso);

/** Texte stable d'une valeur : clés triées, champs vides (null, undefined) ignorés. */
function texteStable(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(texteStable).join(',')}]`;
  if (valeur && typeof valeur === 'object') {
    const champs = Object.entries(valeur)
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${champs.map(([k, v]) => `${JSON.stringify(k)}:${texteStable(v)}`).join(',')}}`;
  }
  return JSON.stringify(valeur);
}

/** Compare deux versions d'une ligne, sans tenir compte de l'ordre des champs ni des marques locales. */
export function memeContenu(a: Synchronisable, b: Synchronisable): boolean {
  const { aSynchroniser: _a, ...x } = a;
  const { aSynchroniser: _b, ...y } = b;
  return texteStable(x) === texteStable(y);
}

/** Nombre de lignes demandées par requête (Supabase en renvoie 1000 au plus). */
const TAILLE_PAGE = 500;
/** Une synchronisation complète (qui détecte aussi les lignes effacées) au moins une fois par jour. */
const INTERVALLE_COMPLETE = 24 * 3600 * 1000;
/** Marge de recouvrement des synchronisations par différence (transactions encore en cours). */
const MARGE_CURSEUR = 60 * 1000;

type Table = 'livres' | 'recettes';

/** Ce qu'on retient de la dernière synchronisation (magasin « meta »). */
interface Curseur {
  /** Plus grande date `synchro_le` reçue du serveur (horloge du serveur). */
  synchroLe: string | null;
  /** Date (horloge de l'appareil) de la dernière synchronisation complète. */
  completeLe: number;
}

export class Depot {
  private livres = new Map<string, Livre>();
  private recettes = new Map<string, Recette>();
  private etat: EtatDepot = { livres: [], recettes: [], synchro: 'locale' };
  private abonnes = new Set<() => void>();
  private synchroEnCours = false;
  private synchroARefaire = false;
  private minuterie: ReturnType<typeof setTimeout> | undefined;
  /** Adresses (object URL) des images déjà chargées. */
  private adressesImages = new Map<string, Promise<string | null>>();

  /** Vrai si la base n'a pas encore la colonne `synchro_le` (script 04 non exécuté). */
  private sansCurseur = false;
  private ferme = false;

  private constructor(
    readonly uid: string,
    private base: IDBDatabase,
  ) {}

  /** Vrai si ce dépôt est relié au cloud (compte connecté). */
  get enLigne() {
    return supabase !== null && this.uid !== UID_LOCAL;
  }

  /** Ouvre la base locale du compte et charge son contenu en mémoire. */
  static async ouvrir(uid: string): Promise<Depot> {
    const depot = new Depot(uid, await ouvrirBase(uid));
    for (const l of await lireTout<Livre>(depot.base, 'livres')) depot.livres.set(l.id, l);
    for (const r of await lireTout<Recette>(depot.base, 'recettes')) {
      // Recettes enregistrées par une version précédente de l'appli
      depot.recettes.set(r.id, { ...r, galerie: r.galerie ?? [], origineId: r.origineId ?? r.id });
    }

    // Mode local, premier lancement : on dépose le livre d'exemple
    if (!depot.enLigne && depot.livres.size === 0) {
      await depot.stocker('livres', depot.livres, livreFictif);
      for (const r of recettesFictives) await depot.stocker('recettes', depot.recettes, r);
    }
    depot.publier();
    return depot;
  }

  /** Ferme la base locale (en quittant le compte) et libère la mémoire des images. */
  fermer() {
    this.ferme = true;
    clearTimeout(this.minuterie);
    this.abonnes.clear();
    for (const promesse of this.adressesImages.values()) void promesse.then((a) => a && URL.revokeObjectURL(a));
    this.adressesImages.clear();
    this.base.close();
  }

  /** Nombre de modifications et de photos pas encore envoyées dans le cloud. */
  async nombreEnAttente(): Promise<number> {
    const lignes = [...this.livres.values(), ...this.recettes.values()].filter((x) => x.aSynchroniser).length;
    const images = (await lireTout<ImageLocale>(this.base, 'images')).filter((i) => i.aEnvoyer || i.aSupprimer).length;
    return lignes + images;
  }

  // ------------------------------------------------------------ Abonnement
  // (interface attendue par le hook React useSyncExternalStore)

  abonner = (rappel: () => void) => {
    this.abonnes.add(rappel);
    return () => this.abonnes.delete(rappel);
  };

  lireEtat = () => this.etat;

  /** Recalcule l'état public et prévient l'interface. */
  private publier(partiel: Partial<Pick<EtatDepot, 'synchro' | 'erreur'>> = {}) {
    const vivants = <T extends Synchronisable>(carte: Map<string, T>) =>
      [...carte.values()].filter((x) => !x.supprimeLe).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    this.etat = {
      ...this.etat,
      ...partiel,
      livres: vivants(this.livres),
      recettes: vivants(this.recettes),
    };
    this.abonnes.forEach((rappel) => rappel());
  }

  private async stocker<T extends Synchronisable>(magasin: Magasin, carte: Map<string, T>, valeur: T) {
    carte.set(valeur.id, valeur);
    await ecrire(this.base, magasin, valeur);
  }

  // ------------------------------------------------------- Livres et recettes

  /** Crée ou modifie un livre. */
  async enregistrerLivre(livre: Omit<Livre, keyof Synchronisable> & Partial<Synchronisable>) {
    const date = maintenant();
    const ancien = livre.id ? this.livres.get(livre.id) : undefined;
    const complet: Livre = {
      ...livre,
      id: livre.id ?? crypto.randomUUID(),
      proprietaireId: this.uid,
      creeLe: livre.creeLe ?? date,
      modifieLe: date,
      aSynchroniser: true,
    };
    await this.stocker('livres', this.livres, complet);
    // L'ancienne image de couverture, si elle a été remplacée ou retirée, est effacée
    if (ancien?.imageCouverture && ancien.imageCouverture !== complet.imageCouverture) {
      await this.supprimerImage(ancien.imageCouverture);
    }
    this.publier();
    this.planifierSynchro();
    return complet;
  }

  /** Supprime un livre, avec toutes ses recettes et leurs images. */
  async supprimerLivre(id: string) {
    const livre = this.livres.get(id);
    if (!livre) return;
    const date = maintenant();
    const marque = { supprimeLe: date, modifieLe: date, aSynchroniser: true };
    await this.stocker('livres', this.livres, { ...livre, ...marque });
    if (livre.imageCouverture) await this.supprimerImage(livre.imageCouverture);
    for (const recette of [...this.recettes.values()]) {
      if (recette.livreId !== id || recette.supprimeLe) continue;
      await this.stocker('recettes', this.recettes, { ...recette, ...marque });
      for (const image of imagesDe(recette)) await this.supprimerImage(image);
    }
    this.publier();
    this.planifierSynchro();
  }

  /**
   * Copie une recette dans un livre. La copie est indépendante : ses photos sont
   * dupliquées, pour que supprimer l'une n'efface pas les images de l'autre.
   */
  async copierRecette(id: string, livreId: string) {
    const origine = this.recettes.get(id);
    if (!origine) return;
    const etapes = [];
    for (const etape of origine.etapes) {
      const image = etape.image ? await this.dupliquerImage(etape.image) : null;
      etapes.push({ texte: etape.texte, ...(image ? { image } : {}) });
    }
    const galerie = [];
    for (const image of origine.galerie) {
      const copie = await this.dupliquerImage(image);
      if (copie) galerie.push(copie);
    }
    return this.enregistrerRecette({
      ...origine,
      id: undefined,
      creeLe: undefined,
      livreId,
      favori: false,
      photoPrincipale: origine.photoPrincipale ? await this.dupliquerImage(origine.photoPrincipale) : null,
      etapes,
      galerie,
    });
  }

  /** Crée ou modifie une recette. */
  async enregistrerRecette(
    recette: Omit<Recette, keyof Synchronisable | 'origineId'> & Partial<Synchronisable> & { origineId?: string },
  ) {
    const date = maintenant();
    const ancienne = recette.id ? this.recettes.get(recette.id) : undefined;
    const id = recette.id ?? crypto.randomUUID();
    const complete: Recette = {
      ...recette,
      id,
      // Une nouvelle recette est sa propre origine ; une copie garde celle de l'original
      origineId: recette.origineId ?? id,
      proprietaireId: this.uid,
      creeLe: recette.creeLe ?? date,
      modifieLe: date,
      aSynchroniser: true,
    };
    await this.stocker('recettes', this.recettes, complete);
    // Les images retirées de la recette sont effacées
    if (ancienne) {
      const gardees = new Set(imagesDe(complete));
      for (const image of imagesDe(ancienne)) if (!gardees.has(image)) await this.supprimerImage(image);
    }
    this.publier();
    this.planifierSynchro();
    return complete;
  }

  /** Ajoute ou retire une recette des favoris (marque-page doré). */
  async basculerFavori(id: string) {
    const recette = this.recettes.get(id);
    if (recette) await this.enregistrerRecette({ ...recette, favori: !recette.favori });
  }

  /** Supprime une recette (et ses images). */
  async supprimerRecette(id: string) {
    const recette = this.recettes.get(id);
    if (!recette) return;
    const date = maintenant();
    await this.stocker('recettes', this.recettes, {
      ...recette,
      supprimeLe: date,
      modifieLe: date,
      aSynchroniser: true,
    });
    for (const image of imagesDe(recette)) await this.supprimerImage(image);
    this.publier();
    this.planifierSynchro();
  }

  // ------------------------------------------------------------------ Images

  /** Compresse une photo, la range sur l'appareil et renvoie son identifiant. */
  async ajouterImage(fichier: Blob): Promise<string> {
    const { blob, extension } = await compresserImage(fichier);
    const id = `${crypto.randomUUID()}.${extension}`;
    const image: ImageLocale = { id, blob, aEnvoyer: true };
    await ecrire(this.base, 'images', image);
    this.adressesImages.set(id, Promise.resolve(URL.createObjectURL(blob)));
    return id;
  }

  /** Range une image déjà prête (sans la recompresser) et renvoie son identifiant. */
  async stockerImage(blob: Blob, extension: string): Promise<string> {
    const id = `${crypto.randomUUID()}.${extension}`;
    await ecrire(this.base, 'images', { id, blob, aEnvoyer: true } satisfies ImageLocale);
    return id;
  }

  /** Contenu d'une image (téléchargée si elle n'est pas encore sur l'appareil). */
  async lireImage(id: string): Promise<Blob | null> {
    let image = await lire<ImageLocale>(this.base, 'images', id);
    if (!image?.blob) {
      await this.chargerImage(id).catch(() => null);
      image = await lire<ImageLocale>(this.base, 'images', id);
    }
    return image?.blob ?? null;
  }

  /**
   * Range dans la bibliothèque le contenu d'une transmission acceptée : un
   * nouveau livre (ou un livre existant) et ses recettes, avec leurs photos.
   * @param images contenu des photos de l'envoi, par identifiant d'origine
   */
  async importer(
    contenu: ContenuEnvoi,
    images: Map<string, Blob>,
    cible: { livreId: string } | { nouveauLivre: string },
    transmisPar: string,
  ) {
    // Chaque photo reçoit un nouvel identifiant dans la bibliothèque du destinataire
    const correspondance = new Map<string, string>();
    for (const [ancien, blob] of images) {
      correspondance.set(ancien, await this.stockerImage(blob, ancien.split('.').pop() || 'jpg'));
    }
    const image = (id: string | null | undefined) => (id ? (correspondance.get(id) ?? null) : null);

    let livreId: string;
    if ('livreId' in cible) {
      livreId = cible.livreId;
    } else {
      const modele = contenu.livre;
      const livre = await this.enregistrerLivre({
        titre: cible.nouveauLivre,
        couleurCuir: modele?.couleurCuir ?? '#5a2415',
        symbole: modele?.symbole ?? 'chaudron',
        imageCouverture: image(modele?.imageCouverture),
        transmisPar,
      });
      livreId = livre.id;
    }

    for (const r of contenu.recettes) {
      await this.enregistrerRecette({
        ...r,
        livreId,
        favori: false,
        transmisPar,
        photoPrincipale: image(r.photoPrincipale),
        galerie: r.galerie.map(image).filter((id): id is string => id !== null),
        etapes: r.etapes.map((e) => {
          const illustration = image(e.image);
          return { texte: e.texte, ...(illustration ? { image: illustration } : {}) };
        }),
      });
    }
    return livreId;
  }

  /** Duplique une image (null si elle est introuvable, par exemple hors ligne). */
  private async dupliquerImage(id: string): Promise<string | null> {
    let image = await lire<ImageLocale>(this.base, 'images', id);
    if (!image?.blob) {
      await this.chargerImage(id).catch(() => null); // la télécharge si besoin
      image = await lire<ImageLocale>(this.base, 'images', id);
    }
    if (!image?.blob) return null;
    const copie = `${crypto.randomUUID()}.${id.split('.').pop()}`;
    await ecrire(this.base, 'images', { id: copie, blob: image.blob, aEnvoyer: true } satisfies ImageLocale);
    return copie;
  }

  /** Oublie l'adresse affichable d'une image et libère sa mémoire. */
  private oublierAdresse(id: string) {
    const promesse = this.adressesImages.get(id);
    this.adressesImages.delete(id);
    // (laissée un instant : une image peut encore être affichée pendant sa disparition)
    void promesse?.then((a) => a && setTimeout(() => URL.revokeObjectURL(a), 5000));
  }

  /**
   * Efface des images ajoutées mais finalement pas gardées (formulaire abandonné…),
   * si aucun livre ni aucune recette ne les utilise.
   */
  async abandonnerImages(ids: string[]) {
    const utilisees = new Set<string>();
    for (const r of this.recettes.values()) if (!r.supprimeLe) imagesDe(r).forEach((i) => utilisees.add(i));
    for (const l of this.livres.values()) if (!l.supprimeLe && l.imageCouverture) utilisees.add(l.imageCouverture);
    for (const id of ids) {
      if (utilisees.has(id)) continue;
      const image = await lire<ImageLocale>(this.base, 'images', id);
      if (!image) continue;
      this.oublierAdresse(id);
      // Jamais envoyée : on l'efface simplement ; sinon on l'efface aussi du cloud
      if (image.aEnvoyer || !this.enLigne) await effacer(this.base, 'images', id);
      else await this.supprimerImage(id);
    }
  }

  private async supprimerImage(id: string) {
    this.oublierAdresse(id);
    if (this.enLigne) {
      // On garde une trace pour l'effacer aussi du cloud à la prochaine synchro
      await ecrire(this.base, 'images', { id, blob: null, aEnvoyer: false, aSupprimer: true } satisfies ImageLocale);
    } else {
      await effacer(this.base, 'images', id);
    }
  }

  /**
   * Adresse affichable d'une image. Elle est lue sur l'appareil ; si elle n'y
   * est pas encore (recette créée sur un autre appareil), elle est téléchargée
   * une fois puis gardée pour la consultation hors ligne.
   */
  adresseImage(id: string): Promise<string | null> {
    let promesse = this.adressesImages.get(id);
    if (!promesse) {
      promesse = this.chargerImage(id).catch(() => null);
      this.adressesImages.set(id, promesse);
      // En cas d'échec (hors ligne…), on réessaiera au prochain affichage
      void promesse.then((adresse) => {
        if (adresse === null) this.adressesImages.delete(id);
      });
    }
    return promesse;
  }

  private async chargerImage(id: string): Promise<string | null> {
    let image = await lire<ImageLocale>(this.base, 'images', id);
    if (!image?.blob && this.enLigne && navigator.onLine) {
      const { data } = await supabase!.storage.from(SEAU_IMAGES).download(`${this.uid}/${id}`);
      if (data) {
        image = { id, blob: data, aEnvoyer: false };
        await ecrire(this.base, 'images', image);
      }
    }
    return image?.blob ? URL.createObjectURL(image.blob) : null;
  }

  // ---------------------------------------------------------- Synchronisation

  /** Regroupe les modifications rapprochées en une seule synchronisation. */
  private planifierSynchro() {
    if (!this.enLigne) return;
    clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => void this.synchroniser(), 1200);
  }

  /**
   * Synchronise avec Supabase :
   *  1. envoi des photos en attente (une photo en échec n'arrête pas le reste) ;
   *  2. récupération des livres et recettes modifiés depuis la dernière fois
   *     (ou de tout, une fois par jour), fusion avec le local ;
   *  3. envoi des modifications locales ;
   *  4. effacement, dans le cloud, des photos supprimées.
   */
  async synchroniser(): Promise<void> {
    if (!this.enLigne || this.ferme) return;
    if (this.synchroEnCours) {
      this.synchroARefaire = true;
      return;
    }
    if (!navigator.onLine) {
      this.publier({ synchro: 'hors-ligne' });
      return;
    }
    this.synchroEnCours = true;
    this.publier({ synchro: 'en-cours', erreur: undefined });

    try {
      const sb = supabase!;
      const stockage = sb.storage.from(SEAU_IMAGES);
      const images = await lireTout<ImageLocale>(this.base, 'images');

      // 1. Photos en attente d'envoi
      let photosEnEchec = 0;
      let dernierEchec: string | undefined;
      for (const image of images) {
        if (!image.aEnvoyer || !image.blob) continue;
        const { error } = await stockage.upload(`${this.uid}/${image.id}`, image.blob, {
          upsert: true,
          contentType: image.blob.type,
        });
        if (error) {
          photosEnEchec++;
          dernierEchec = error.message;
          continue;
        }
        await ecrire(this.base, 'images', { ...image, aEnvoyer: false });
      }

      // 2. Récupération et fusion (les livres d'abord : les recettes en dépendent)
      for (const table of ['livres', 'recettes'] as const) {
        const curseur = await this.lireCurseur(table);
        const complete = this.sansCurseur || !curseur.synchroLe || Date.now() - curseur.completeLe > INTERVALLE_COMPLETE;
        const depuis = complete ? null : new Date(dateDe(curseur.synchroLe!) - MARGE_CURSEUR).toISOString();
        const lignes = await this.telecharger(table, depuis);
        if (table === 'livres') await this.fusionner('livres', this.livres, lignes.map(ligneVersLivre), complete);
        else await this.fusionner('recettes', this.recettes, lignes.map(ligneVersRecette), complete);
        const plusRecente = lignes.reduce<string | null>(
          (max, x) => (x.synchro_le && (!max || x.synchro_le > max) ? x.synchro_le : max),
          curseur.synchroLe,
        );
        await this.ecrireCurseur(table, { synchroLe: plusRecente, completeLe: complete ? Date.now() : curseur.completeLe });
      }

      // Tout premier lancement du compte (aucun livre, même supprimé) : on crée son premier livre
      if (this.livres.size === 0) {
        const date = maintenant();
        await this.stocker('livres', this.livres, {
          id: crypto.randomUUID(),
          proprietaireId: this.uid,
          titre: 'Mon grimoire',
          couleurCuir: '#5a2415',
          symbole: 'chaudron',
          creeLe: date,
          modifieLe: date,
          aSynchroniser: true,
        });
      }

      // 3. Envoi des modifications locales
      await this.envoyer('livres', this.livres, livreVersLigne);
      await this.envoyer('recettes', this.recettes, recetteVersLigne);

      // 4. Photos supprimées
      const aSupprimer = images.filter((i) => i.aSupprimer);
      for (let i = 0; i < aSupprimer.length; i += 500) {
        const paquet = aSupprimer.slice(i, i + 500);
        const { error } = await stockage.remove(paquet.map((x) => `${this.uid}/${x.id}`));
        if (error) throw error;
        for (const image of paquet) await effacer(this.base, 'images', image.id);
      }

      if (photosEnEchec > 0) {
        const s = photosEnEchec > 1 ? 's' : '';
        this.publier({
          synchro: 'erreur',
          erreur: `${photosEnEchec} photo${s} n’${photosEnEchec > 1 ? 'ont' : 'a'} pas pu être envoyée${s} (${dernierEchec}) ; nouvel essai à la prochaine synchronisation.`,
        });
      } else {
        this.publier({ synchro: 'a-jour' });
      }
    } catch (erreur) {
      console.error('Synchronisation impossible', erreur);
      const detail = erreur instanceof Error ? erreur.message : String((erreur as { message?: string })?.message ?? erreur);
      if (!this.ferme) this.publier({ synchro: navigator.onLine ? 'erreur' : 'hors-ligne', erreur: detail });
    } finally {
      this.synchroEnCours = false;
      if (this.synchroARefaire) {
        this.synchroARefaire = false;
        void this.synchroniser();
      }
    }
  }

  private async lireCurseur(table: Table): Promise<Curseur> {
    return (await lire<Curseur>(this.base, 'meta', `curseur:${table}`)) ?? { synchroLe: null, completeLe: 0 };
  }

  private ecrireCurseur(table: Table, curseur: Curseur) {
    return ecrire(this.base, 'meta', curseur, `curseur:${table}`);
  }

  /**
   * Lignes d'une table, page par page (sans quoi Supabase s'arrête à 1000).
   * @param depuis seulement les lignes modifiées après cette date (serveur), ou tout si null
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async telecharger(table: Table, depuis: string | null): Promise<any[]> {
    const toutes: any[] = [];
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      let requete = supabase!.from(table).select('*');
      if (depuis && !this.sansCurseur) requete = requete.gt('synchro_le', depuis);
      const { data, error } = await requete.order('id').range(debut, debut + TAILLE_PAGE - 1);
      if (error) {
        // Base pas encore mise à jour : pas de colonne synchro_le, on prend tout
        if (!this.sansCurseur && /synchro_le/.test(error.message)) {
          console.warn('Colonne « synchro_le » absente : exécutez supabase/04_securite.sql');
          this.sansCurseur = true;
          return this.telecharger(table, null);
        }
        throw error;
      }
      toutes.push(...data);
      if (data.length < TAILLE_PAGE) return toutes;
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /** Fusionne les lignes venues du cloud avec les données locales. */
  private async fusionner<T extends Synchronisable>(magasin: Magasin, carte: Map<string, T>, distants: T[], complete: boolean) {
    const vus = new Set<string>();
    for (const distant of distants) {
      vus.add(distant.id);
      const local = carte.get(distant.id);
      // Une modification locale non envoyée et plus récente est conservée
      if (local?.aSynchroniser && dateDe(local.modifieLe) >= dateDe(distant.modifieLe)) continue;
      // Sinon, la version du cloud fait foi dès qu'elle diffère (même à date égale :
      // deux appareils peuvent écrire dans la même milliseconde)
      if (!local || local.aSynchroniser || !memeContenu(local, distant)) {
        await this.stocker(magasin, carte, distant);
      }
    }
    // Ce qui a disparu du cloud (et n'attend pas d'envoi) disparaît aussi ici.
    // (Seulement lors d'une synchronisation complète : une synchronisation par
    // différence ne reçoit que les lignes modifiées.)
    if (!complete) return;
    for (const local of [...carte.values()]) {
      if (!vus.has(local.id) && !local.aSynchroniser) {
        carte.delete(local.id);
        await effacer(this.base, magasin, local.id);
      }
    }
  }

  /** Envoie au cloud les lignes marquées « à synchroniser ». */
  private async envoyer<T extends Synchronisable>(magasin: 'livres' | 'recettes', carte: Map<string, T>, versLigne: (x: T) => object) {
    const enAttente = [...carte.values()].filter((x) => x.aSynchroniser);
    if (enAttente.length === 0) return;
    /** Envoi réussi : l'élément n'attend plus (sauf s'il a encore changé entre-temps). */
    const envoye = async (element: T) => {
      if (carte.get(element.id) === element) await this.stocker(magasin, carte, { ...element, aSynchroniser: false });
    };
    const refusees: string[] = [];
    for (let i = 0; i < enAttente.length; i += TAILLE_PAGE) {
      const paquet = enAttente.slice(i, i + TAILLE_PAGE);
      let lignes = paquet.map(versLigne) as Record<string, unknown>[];
      let { error } = await supabase!.from(magasin).upsert(lignes);
      // Base pas encore mise à jour (un script de supabase/ non exécuté) : on envoie
      // quand même le reste, sans les colonnes inconnues de la base.
      for (let essai = 0; error && essai < 4; essai++) {
        const colonne = /could not find the '(\w+)' column/i.exec(error.message)?.[1];
        if (!colonne) break;
        console.warn(`Colonne « ${colonne} » absente de la base : exécutez les scripts de supabase/`);
        lignes = lignes.map(({ [colonne]: _ignoree, ...reste }) => reste);
        ({ error } = await supabase!.from(magasin).upsert(lignes));
      }
      if (!error) {
        for (const element of paquet) await envoye(element);
        continue;
      }
      // Une ligne refusée par la base (valeur hors limites…) ne doit pas bloquer
      // les autres : on les envoie alors une par une.
      if (!/^(23514|23503|22001)$/.test(error.code ?? '')) throw error;
      for (const [j, ligne] of lignes.entries()) {
        const seule = await supabase!.from(magasin).upsert(ligne);
        if (seule.error) refusees.push(`« ${String(ligne.titre)} »`);
        else await envoye(paquet[j]);
      }
    }
    if (refusees.length > 0) {
      const plusieurs = refusees.length > 1;
      throw new Error(
        `Refusé par le cloud (valeur trop longue ou invalide) : ${refusees.join(', ')}. Modifiez ${plusieurs ? 'ces éléments' : 'cet élément'} pour réessayer.`,
      );
    }
  }
}

/** Tous les identifiants d'images utilisés par une recette. */
export function imagesDe(recette: Recette): string[] {
  return [
    ...(recette.photoPrincipale ? [recette.photoPrincipale] : []),
    ...recette.galerie,
    ...recette.etapes.flatMap((e) => (e.image ? [e.image] : [])),
  ];
}
