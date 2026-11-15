// Base de données locale (IndexedDB) : c'est elle que l'appli lit et écrit en
// premier, ce qui permet de consulter et modifier ses recettes hors ligne.
// Une base par compte, pour ne pas mélanger les données sur un appareil partagé.

export type Magasin = 'livres' | 'recettes' | 'images' | 'meta';

/** Image stockée sur l'appareil. */
export interface ImageLocale {
  id: string;
  blob: Blob | null;
  /** Vrai tant que l'image n'a pas été envoyée dans le cloud. */
  aEnvoyer: boolean;
  /** Vrai si l'image doit être effacée du cloud à la prochaine synchro. */
  aSupprimer?: boolean;
}

export function ouvrirBase(uid: string): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const demande = indexedDB.open(`grimoire-${uid}`, 1);
    demande.onupgradeneeded = () => {
      const base = demande.result;
      base.createObjectStore('livres', { keyPath: 'id' });
      base.createObjectStore('recettes', { keyPath: 'id' });
      base.createObjectStore('images', { keyPath: 'id' });
      base.createObjectStore('meta');
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error);
  });
}

/** Transforme une requête IndexedDB en promesse. */
function promesse<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

export const lireTout = <T>(base: IDBDatabase, magasin: Magasin) =>
  promesse<T[]>(base.transaction(magasin).objectStore(magasin).getAll());

export const lire = <T>(base: IDBDatabase, magasin: Magasin, cle: string) =>
  promesse<T | undefined>(base.transaction(magasin).objectStore(magasin).get(cle));

/** Écrit une valeur. `cle` n'est nécessaire que pour le magasin « meta ». */
export const ecrire = (base: IDBDatabase, magasin: Magasin, valeur: unknown, cle?: string) =>
  promesse(base.transaction(magasin, 'readwrite').objectStore(magasin).put(valeur, cle));

export const effacer = (base: IDBDatabase, magasin: Magasin, cle: string) =>
  promesse(base.transaction(magasin, 'readwrite').objectStore(magasin).delete(cle));
