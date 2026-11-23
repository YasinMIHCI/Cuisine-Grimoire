// Détection des durées dans le texte des étapes, et petit signal sonore.

export interface Duree {
  /** Texte trouvé, ex. « 30 minutes ». */
  libelle: string;
  secondes: number;
}

/**
 * Trouve les durées écrites dans une étape : « 30 minutes », « 3 heures »,
 * « 1 h 30 », « 10 min », « 5 mn », « 45 secondes ». (« 6 à 7 minutes » → 7 minutes.)
 */
export function trouverDurees(texte: string): Duree[] {
  const motif = /(\d+(?:[.,]\d+)?)\s*(heures?|h|minutes?|mins?|mn|secondes?|secs?)(?![a-zà-ÿ])(?:\s*(\d{2})(?!\s*[°\d]))?/gi;
  const durees: Duree[] = [];
  for (const m of texte.matchAll(motif)) {
    const n = parseFloat(m[1].replace(',', '.'));
    const unite = m[2].toLowerCase();
    let secondes: number;
    if (unite.startsWith('h')) secondes = n * 3600 + (m[3] ? parseInt(m[3], 10) * 60 : 0);
    else if (unite.startsWith('m')) secondes = n * 60;
    else secondes = n;
    if (secondes > 0 && secondes <= 48 * 3600) durees.push({ libelle: m[0].trim(), secondes: Math.round(secondes) });
  }
  return durees;
}

/** « 1:05:00 », « 12:30 »… */
export function formaterCompte(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Trois bips (le contexte audio doit avoir été créé lors d'un geste de l'utilisateur). */
export function sonner(contexte: AudioContext | null) {
  if (!contexte) return;
  void contexte.resume();
  for (const decalage of [0, 0.45, 0.9]) {
    const t = contexte.currentTime + decalage;
    const oscillateur = contexte.createOscillator();
    const volume = contexte.createGain();
    oscillateur.frequency.value = 880;
    oscillateur.connect(volume);
    volume.connect(contexte.destination);
    volume.gain.setValueAtTime(0.0001, t);
    volume.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    oscillateur.start(t);
    oscillateur.stop(t + 0.36);
  }
}
