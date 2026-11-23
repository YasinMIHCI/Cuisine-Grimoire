import { describe, expect, it } from 'vitest';
import { lireLigneIngredient, lireListeIngredients, lireQuantite } from './quantites';

describe('lireQuantite', () => {
  it.each([
    ['2', 2],
    ['2,5', 2.5],
    ['0.25', 0.25],
    ['1/2', 0.5],
    [' 3 / 4 ', 0.75],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['2 ¼', 2.25],
  ])('« %s » → %d', (texte, attendu) => {
    expect(lireQuantite(texte)).toBeCloseTo(attendu);
  });

  it.each(['', 'abc', '2 kg', '1/0', '1/2/3'])('« %s » n’est pas une quantité', (texte) => {
    expect(lireQuantite(texte)).toBeNull();
  });
});

describe('lireLigneIngredient', () => {
  it('lit quantité, unité et nom', () => {
    expect(lireLigneIngredient('200 g de farine')).toEqual({ quantite: 200, unite: 'g', nom: 'farine' });
    expect(lireLigneIngredient('- 1/2 c. à café de sel')).toEqual({ quantite: 0.5, unite: 'c. à café', nom: 'sel' });
    expect(lireLigneIngredient('25 cl d’eau')).toEqual({ quantite: 25, unite: 'cl', nom: 'eau' });
    expect(lireLigneIngredient('2 gousses d’ail')).toEqual({ quantite: 2, unite: 'gousses', nom: 'ail' });
  });

  it('accepte une ligne sans unité ou sans quantité', () => {
    expect(lireLigneIngredient('3 œufs')).toEqual({ quantite: 3, unite: '', nom: 'œufs' });
    expect(lireLigneIngredient('• sel, poivre')).toEqual({ quantite: null, unite: '', nom: 'sel, poivre' });
  });

  it('ne prend pas le début d’un mot pour une unité', () => {
    expect(lireLigneIngredient('2 gros oignons')).toEqual({ quantite: 2, unite: '', nom: 'gros oignons' });
    expect(lireLigneIngredient('1 litchi')).toEqual({ quantite: 1, unite: '', nom: 'litchi' });
  });

  it('ignore les lignes vides', () => {
    expect(lireListeIngredients('200 g farine\n\n  \n3 œufs')).toHaveLength(2);
  });
});
