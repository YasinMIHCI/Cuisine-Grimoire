// Le « dépôt » : source unique des données de l'appli (livres, recettes, images).
//
// Principe « local d'abord » :
//  - toute lecture et toute écriture passent par la base locale (IndexedDB),
//    l'appli fonctionne donc hors ligne ;
//  - chaque modification est marquée « à synchroniser » puis envoyée à Supabase
//    dès que le réseau est là ;
//  - en cas de conflit entre deux appareils, la modification la plus récente
//    l'emporte (champ modifieLe).
import type { Livre, Recette, Synchronisable } from '../types';
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
    for (const r of await lireTout<Recette>(depot.base, 'recettes')) depot.recettes.set(r.id, r);

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
    const complet: Livre = {
      ...livre,
      id: livre.id ?? crypto.randomUUID(),
      proprietaireId: this.uid,
      creeLe: livre.creeLe ?? date,
      modifieLe: date,
      aSynchroniser: true,
    };
    await this.stocker('livres', this.livres, complet);
    this.publier();
    this.planifierSynchro();
    return complet;
  }

  /** Crée ou modifie une recette. */
  async enregistrerRecette(recette: Omit<Recette, keyof Synchronisable> & Partial<Synchronisable>) {
    const date = maintenant();
    const ancienne = recette.id ? this.recettes.get(recette.id) : undefined;
    const complete: Recette = {
      ...recette,
      id: recette.id ?? crypto.randomUUID(),
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

      // Tout premier lancement du compte : on crée son premier livre
      if (![...this.livres.values()].some((l) => !l.supprimeLe)) {
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
    const { error } = await supabase!.from(magasin).upsert(enAttente.map(versLigne));
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
function imagesDe(recette: Recette): string[] {
  return [
    ...(recette.photoPrincipale ? [recette.photoPrincipale] : []),
    ...recette.galerie,
    ...recette.etapes.flatMap((e) => (e.image ? [e.image] : [])),
  ];
}
