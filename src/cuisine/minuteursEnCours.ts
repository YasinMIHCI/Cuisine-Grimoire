// Minuteurs de cuisine, communs à toute l'appli : ils continuent quand on
// quitte le mode cuisine, survivent à un rechargement (gardés sur l'appareil)
// et préviennent par une notification quand l'appli est en arrière-plan.
import { useSyncExternalStore } from 'react';
import { sonner } from './minuteurs';

export interface Minuteur {
  id: string;
  libelle: string;
  /** Recette concernée (affichée dans la notification). */
  recette: string;
  /** Instant de fin (ms). */
  fin: number;
  sonne: boolean;
}

const CLE = 'grimoire:minuteurs';
/** Un minuteur fini depuis plus longtemps est oublié au lancement. */
const OUBLI = 3600 * 1000;

function charger(): Minuteur[] {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE) ?? '[]') as Minuteur[];
    return Array.isArray(liste) ? liste.filter((m) => m.fin > Date.now() - OUBLI) : [];
  } catch {
    return [];
  }
}

let minuteurs: Minuteur[] = charger();
let maintenant = Date.now();
let audio: AudioContext | null = null;
let tic: ReturnType<typeof setInterval> | undefined;
const abonnes = new Set<() => void>();

function publier(liste: Minuteur[]) {
  minuteurs = liste;
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // stockage indisponible : les minuteurs ne survivront pas à un rechargement
  }
  abonnes.forEach((f) => f());
  demarrer();
}

/** Prévient que des minuteurs sont finis : son, vibration, notification. */
function alerter(finis: Minuteur[]) {
  sonner(audio);
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  if (document.visibilityState === 'visible' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  for (const m of finis) {
    const options = { body: `${m.recette} : ${m.libelle}`, tag: m.id, requireInteraction: true } as NotificationOptions;
    void navigator.serviceWorker?.ready
      .then((enregistrement) => enregistrement.showNotification('Minuteur terminé', options))
      .catch(() => new Notification('Minuteur terminé', options));
  }
}

function verifier() {
  maintenant = Date.now();
  const finis = minuteurs.filter((m) => !m.sonne && m.fin <= maintenant);
  if (finis.length > 0) {
    alerter(finis);
    publier(minuteurs.map((m) => (finis.includes(m) ? { ...m, sonne: true } : m)));
  } else {
    abonnes.forEach((f) => f());
  }
}

function demarrer() {
  const actifs = minuteurs.length > 0;
  if (actifs && !tic) tic = setInterval(verifier, 1000);
  if (!actifs && tic) {
    clearInterval(tic);
    tic = undefined;
  }
}

// Retour dans l'appli (téléphone en veille…) : on rattrape tout de suite
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verifier());
  demarrer();
}

/** À appeler lors d'un geste de l'utilisateur : le son doit être « débloqué » à ce moment-là. */
export function preparerSon() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // pas de son possible
  }
}

export function lancerMinuteur(recette: string, libelle: string, secondes: number) {
  preparerSon();
  // Une notification est demandée une seule fois, au premier minuteur
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
  maintenant = Date.now();
  publier([...minuteurs, { id: crypto.randomUUID(), libelle, recette, fin: Date.now() + secondes * 1000, sonne: false }]);
}

export function arreterMinuteur(id: string) {
  publier(minuteurs.filter((m) => m.id !== id));
}

/** Les minuteurs et l'heure du dernier tic (pour le décompte). */
export function useMinuteurs() {
  const liste = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => minuteurs,
  );
  // L'heure change à chaque tic : on s'abonne aussi à elle
  const heure = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => maintenant,
  );
  return { minuteurs: liste, maintenant: heure };
}
