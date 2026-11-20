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
      for (const id of imagesDe(ancienne)) if (!gardees.has(id)) await this.supprimerImage(id);
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

  private async supprimerImage(id: string) {
    this.adressesImages.delete(id);
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
   *  1. envoi des photos en attente ;
   *  2. récupération des livres et recettes du cloud, fusion avec le local ;
   *  3. envoi des modifications locales ;
   *  4. effacement, dans le cloud, des photos supprimées.
   */
  async synchroniser(): Promise<void> {
    if (!this.enLigne) return;
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
      for (const image of images) {
        if (!image.aEnvoyer || !image.blob) continue;
        const { error } = await stockage.upload(`${this.uid}/${image.id}`, image.blob, {
          upsert: true,
          contentType: image.blob.type,
        });
        if (error) throw error;
        await ecrire(this.base, 'images', { ...image, aEnvoyer: false });
      }

      // 2. Récupération et fusion (les livres d'abord : les recettes en dépendent)
      const distantsLivres = await sb.from('livres').select('*');
      if (distantsLivres.error) throw distantsLivres.error;
      const distantesRecettes = await sb.from('recettes').select('*');
      if (distantesRecettes.error) throw distantesRecettes.error;
      await this.fusionner('livres', this.livres, distantsLivres.data.map(ligneVersLivre));
      await this.fusionner('recettes', this.recettes, distantesRecettes.data.map(ligneVersRecette));

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
      if (aSupprimer.length > 0) {
        const { error } = await stockage.remove(aSupprimer.map((i) => `${this.uid}/${i.id}`));
        if (error) throw error;
        for (const image of aSupprimer) await effacer(this.base, 'images', image.id);
      }

      this.publier({ synchro: 'a-jour' });
    } catch (erreur) {
      console.error('Synchronisation impossible', erreur);
      const detail = erreur instanceof Error ? erreur.message : String((erreur as { message?: string })?.message ?? erreur);
      this.publier({ synchro: navigator.onLine ? 'erreur' : 'hors-ligne', erreur: detail });
    } finally {
      this.synchroEnCours = false;
      if (this.synchroARefaire) {
        this.synchroARefaire = false;
        void this.synchroniser();
      }
    }
  }

  /** Fusionne les lignes venues du cloud avec les données locales. */
  private async fusionner<T extends Synchronisable>(magasin: Magasin, carte: Map<string, T>, distants: T[]) {
    const vus = new Set<string>();
    for (const distant of distants) {
      vus.add(distant.id);
      const local = carte.get(distant.id);
      // Une modification locale non envoyée et plus récente est conservée
      if (local?.aSynchroniser && dateDe(local.modifieLe) >= dateDe(distant.modifieLe)) continue;
      if (!local || dateDe(distant.modifieLe) !== dateDe(local.modifieLe) || local.aSynchroniser) {
        await this.stocker(magasin, carte, distant);
      }
    }
    // Ce qui a disparu du cloud (et n'attend pas d'envoi) disparaît aussi ici
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
    let lignes = enAttente.map(versLigne) as Record<string, unknown>[];
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
    if (error) throw error;
    for (const element of enAttente) {
      // Si l'élément a encore changé pendant l'envoi, il repartira au prochain tour
      if (carte.get(element.id) === element) {
        await this.stocker(magasin, carte, { ...element, aSynchroniser: false });
      }
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
