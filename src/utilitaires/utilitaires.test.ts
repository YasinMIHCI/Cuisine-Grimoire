import { describe, expect, it } from 'vitest';
import { enChiffresRomains, formaterDuree, formaterQuantite } from './format';
import { repartirEnPages } from './pagination';
import { normaliser, rechercher } from './recherche';
import { ajusterQuantite, recetteEnTexte } from './texte';
import { recettesFictives } from '../donnees/donneesFictives';

describe('format', () => {
  it('chiffres romains', () => {
    expect(enChiffresRomains(4)).toBe('IV');
    expect(enChiffresRomains(1994)).toBe('MCMXCIV');
  });
  it('durées', () => {
    expect(formaterDuree(0)).toBe('—');
    expect(formaterDuree(45)).toBe('45 min');
    expect(formaterDuree(180)).toBe('3 h');
    expect(formaterDuree(65)).toBe('1 h 05');
  });
  it('quantités', () => {
    expect(formaterQuantite(2.5)).toBe('2,5');
    expect(formaterQuantite(1 / 3)).toBe('0,33');
  });
});

describe('repartirEnPages', () => {
  it('remplit les pages dans l’ordre', () => {
    expect(repartirEnPages([40, 40, 40], [false, false, false], 100)).toEqual([[0, 1], [2]]);
  });
  it('garde un titre avec le bloc suivant', () => {
    expect(repartirEnPages([50, 20, 60], [false, true, false], 100)).toEqual([[0], [1, 2]]);
  });
  it('commence une page quand c’est demandé', () => {
    expect(repartirEnPages([10, 10], [false, false], 100, [false, true])).toEqual([[0], [1]]);
  });
  it('place seul un bloc trop haut', () => {
    expect(repartirEnPages([10, 300, 10], [false, false, false], 100)).toEqual([[0], [1], [2]]);
  });
});

describe('recherche', () => {
  it('normalise accents et ligatures', () => {
    expect(normaliser(' Œufs Brouillés ')).toBe('oeufs brouilles');
  });
  it('trouve par titre et par ingrédient', () => {
    const resultats = rechercher(recettesFictives, 'tarte pomme');
    expect(resultats.map((r) => r.recette.titre)).toContain('Tarte Tatin');
  });
  it('ne trouve pas « œuf » dans « bœuf »', () => {
    const titres = rechercher(recettesFictives, 'oeuf').map((r) => r.recette.titre);
    expect(titres).not.toContain('Bœuf bourguignon');
  });
  it('filtre les favoris', () => {
    expect(rechercher(recettesFictives, '', true).every((r) => r.recette.favori)).toBe(true);
  });
});

describe('ajusterQuantite', () => {
  it('arrondit naturellement', () => {
    expect(ajusterQuantite(4, 4 / 3)).toBe(5);
    expect(ajusterQuantite(2, 1.25, 'c. à s.')).toBe(2.5);
    expect(ajusterQuantite(250, 4 / 3, 'g')).toBe(330);
    expect(ajusterQuantite(1, 0.25)).toBe(1);
    expect(ajusterQuantite(3, 1, 'g')).toBe(3);
  });
});

describe('recetteEnTexte', () => {
  it('contient titre, ingrédients et étapes', () => {
    const texte = recetteEnTexte(recettesFictives[0]);
    expect(texte).toContain(recettesFictives[0].titre.toUpperCase());
    expect(texte).toContain('INGRÉDIENTS');
    expect(texte).toContain('1. ');
  });
});
