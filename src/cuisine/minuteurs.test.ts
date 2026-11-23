import { describe, expect, it } from 'vitest';
import { formaterCompte, trouverDurees } from './minuteurs';

describe('trouverDurees', () => {
  const secondes = (texte: string) => trouverDurees(texte).map((d) => d.secondes);

  it('reconnaît les écritures courantes', () => {
    expect(secondes('Cuire 30 minutes')).toEqual([1800]);
    expect(secondes('Laisser reposer 3 heures')).toEqual([10800]);
    expect(secondes('Mijoter 1 h 30')).toEqual([5400]);
    expect(secondes('Mijoter 1h30')).toEqual([5400]);
    expect(secondes('Fouetter 5 mn')).toEqual([300]);
    expect(secondes('Chauffer 45 secondes')).toEqual([45]);
    expect(secondes('Cuire 1,5 h')).toEqual([5400]);
  });

  it('garde la borne haute d’un intervalle', () => {
    expect(secondes('Cuire 6 à 7 minutes')).toEqual([420]);
  });

  it('ne confond pas les températures ni les mots', () => {
    expect(secondes('Four à 180 °C pendant 20 min')).toEqual([1200]);
    expect(secondes('Ajouter 2 huîtres')).toEqual([]);
    expect(secondes('Ajouter 3 mangues')).toEqual([]);
  });

  it('ignore les durées absurdes', () => {
    expect(secondes('Laisser 72 heures')).toEqual([]);
  });
});

describe('formaterCompte', () => {
  it('affiche minutes et heures', () => {
    expect(formaterCompte(65)).toBe('1:05');
    expect(formaterCompte(3900)).toBe('1:05:00');
    expect(formaterCompte(-3)).toBe('0:00');
  });
});
