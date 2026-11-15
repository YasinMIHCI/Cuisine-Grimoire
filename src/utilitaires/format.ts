// Petites fonctions d'affichage.

/** Convertit un nombre en chiffres romains (numéros de chapitre). */
export function enChiffresRomains(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let reste = n;
  let resultat = '';
  for (const [valeur, symbole] of table) {
    while (reste >= valeur) {
      resultat += symbole;
      reste -= valeur;
    }
  }
  return resultat;
}

/** Affiche une durée en minutes : 45 → « 45 min », 180 → « 3 h », 95 → « 1 h 35 ». */
export function formaterDuree(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Affiche une quantité sans décimales inutiles, avec la virgule française. */
export function formaterQuantite(quantite: number): string {
  return (Math.round(quantite * 100) / 100).toString().replace('.', ',');
}
