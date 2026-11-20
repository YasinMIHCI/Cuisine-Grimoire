// Données d'exemple : un livre et quelques recettes.
// Elles ne servent qu'en « mode local » (appli non reliée à Supabase), pour
// avoir de quoi feuilleter au premier lancement.
import type { ApparenceLivre, Livre, Recette } from '../types';

const DATE = '2026-01-01T00:00:00.000Z';
const communs = { proprietaireId: 'local', creeLe: DATE, modifieLe: DATE };

/** Apparence du livre montré dans l'intro tant qu'aucun livre n'a été ouvert. */
export const livreParDefaut: ApparenceLivre = {
  titre: 'Recette et Grimoire',
  couleurCuir: '#5a2415',
  symbole: 'chaudron',
};

export const livreFictif: Livre = { id: 'livre-1', ...livreParDefaut, ...communs };

type RecetteExemple = Omit<Recette, 'proprietaireId' | 'creeLe' | 'modifieLe' | 'galerie' | 'origineId'>;

const exemples: RecetteExemple[] = [
  {
    id: 'r1',
    livreId: 'livre-1',
    titre: 'Velouté de potimarron',
    categorie: 'Entrées',
    tempsPreparation: 15,
    tempsCuisson: 30,
    portions: 4,
    symbole: 'chaudron',
    favori: true,
    ingredients: [
      { quantite: 1, unite: '', nom: 'potimarron (environ 1 kg)' },
      { quantite: 1, unite: '', nom: 'oignon jaune' },
      { quantite: 75, unite: 'cl', nom: 'bouillon de légumes' },
      { quantite: 10, unite: 'cl', nom: 'crème fraîche' },
      { quantite: 20, unite: 'g', nom: 'beurre' },
      { quantite: null, unite: '', nom: 'noix de muscade, sel, poivre' },
    ],
    etapes: [
      { texte: 'Laver le potimarron, l’épépiner et le couper en cubes sans l’éplucher.' },
      { texte: 'Faire fondre le beurre dans une cocotte et y faire suer l’oignon émincé.' },
      { texte: 'Ajouter les cubes de potimarron, couvrir de bouillon et laisser frémir 30 minutes.' },
      { texte: 'Mixer finement, ajouter la crème, la muscade, saler et poivrer.' },
    ],
    notes: 'Encore meilleur avec quelques châtaignes grillées et un filet d’huile de noisette.',
  },
  {
    id: 'r2',
    livreId: 'livre-1',
    titre: 'Œufs mimosa',
    categorie: 'Entrées',
    tempsPreparation: 20,
    tempsCuisson: 10,
    portions: 4,
    symbole: 'etoile',
    favori: false,
    ingredients: [
      { quantite: 6, unite: '', nom: 'œufs' },
      { quantite: 3, unite: 'c. à s.', nom: 'mayonnaise maison' },
      { quantite: 1, unite: 'c. à c.', nom: 'moutarde' },
      { quantite: null, unite: '', nom: 'ciboulette, sel, poivre' },
    ],
    etapes: [
      { texte: 'Cuire les œufs 10 minutes à l’eau bouillante, puis les rafraîchir et les écaler.' },
      { texte: 'Couper les œufs en deux, retirer les jaunes et en réserver deux pour le décor.' },
      { texte: 'Écraser les autres jaunes avec la mayonnaise, la moutarde et la ciboulette.' },
      { texte: 'Garnir les blancs, puis râper par-dessus les jaunes réservés.' },
    ],
    notes: '',
  },
  {
    id: 'r3',
    livreId: 'livre-1',
    titre: 'Bœuf bourguignon',
    categorie: 'Plats',
    tempsPreparation: 30,
    tempsCuisson: 180,
    portions: 6,
    symbole: 'flamme',
    favori: true,
    ingredients: [
      { quantite: 1.2, unite: 'kg', nom: 'bœuf à braiser (paleron, joue)' },
      { quantite: 75, unite: 'cl', nom: 'vin rouge de Bourgogne' },
      { quantite: 200, unite: 'g', nom: 'lardons fumés' },
      { quantite: 250, unite: 'g', nom: 'champignons de Paris' },
      { quantite: 4, unite: '', nom: 'carottes' },
      { quantite: 2, unite: '', nom: 'oignons' },
      { quantite: 2, unite: 'c. à s.', nom: 'farine' },
      { quantite: 1, unite: '', nom: 'bouquet garni' },
    ],
    etapes: [
      { texte: 'Faire dorer les lardons dans une cocotte en fonte, les réserver.' },
      { texte: 'Saisir la viande coupée en gros cubes dans la graisse des lardons, par petites quantités.' },
      { texte: 'Ajouter oignons et carottes en rondelles, saupoudrer de farine et remuer 2 minutes.' },
      { texte: 'Mouiller avec le vin, ajouter le bouquet garni et les lardons. Porter à frémissement.' },
      { texte: 'Couvrir et laisser mijoter 3 heures à feu très doux, en remuant de temps à autre.' },
      { texte: 'Ajouter les champignons poêlés 20 minutes avant la fin. Rectifier l’assaisonnement.' },
    ],
    notes: 'À préparer la veille : il est toujours meilleur réchauffé. Servir avec des pommes vapeur.',
  },
  {
    id: 'r4',
    livreId: 'livre-1',
    titre: 'Truite aux amandes',
    categorie: 'Plats',
    tempsPreparation: 10,
    tempsCuisson: 15,
    portions: 2,
    symbole: 'poisson',
    favori: false,
    ingredients: [
      { quantite: 2, unite: '', nom: 'truites vidées' },
      { quantite: 50, unite: 'g', nom: 'amandes effilées' },
      { quantite: 60, unite: 'g', nom: 'beurre' },
      { quantite: 1, unite: '', nom: 'citron' },
      { quantite: null, unite: '', nom: 'farine, persil, sel, poivre' },
    ],
    etapes: [
      { texte: 'Saler, poivrer et fariner légèrement les truites.' },
      { texte: 'Les cuire au beurre mousseux, 6 à 7 minutes par face.' },
      { texte: 'Dorer les amandes dans le reste du beurre, arroser de jus de citron.' },
      { texte: 'Napper les truites de beurre aux amandes et parsemer de persil.' },
    ],
    notes: '',
  },
  {
    id: 'r5',
    livreId: 'livre-1',
    titre: 'Tarte Tatin',
    categorie: 'Desserts',
    tempsPreparation: 25,
    tempsCuisson: 45,
    portions: 8,
    symbole: 'lune',
    favori: true,
    ingredients: [
      { quantite: 1, unite: '', nom: 'pâte brisée' },
      { quantite: 8, unite: '', nom: 'pommes (reinettes ou golden)' },
      { quantite: 150, unite: 'g', nom: 'sucre' },
      { quantite: 80, unite: 'g', nom: 'beurre demi-sel' },
    ],
    etapes: [
      { texte: 'Préparer un caramel blond avec le sucre directement dans le moule, ajouter le beurre.' },
      { texte: 'Éplucher les pommes, les couper en quartiers et les serrer debout sur le caramel.' },
      { texte: 'Cuire 15 minutes sur feu doux, puis recouvrir de pâte en rentrant les bords.' },
      { texte: 'Enfourner 30 minutes à 190 °C. Laisser tiédir 10 minutes et retourner d’un geste sûr.' },
    ],
    notes: 'Servir tiède, avec une cuillerée de crème crue.',
  },
  {
    id: 'r6',
    livreId: 'livre-1',
    titre: 'Pain d’épices',
    categorie: 'Desserts',
    tempsPreparation: 15,
    tempsCuisson: 50,
    portions: 10,
    symbole: 'epi',
    favori: false,
    ingredients: [
      { quantite: 250, unite: 'g', nom: 'miel' },
      { quantite: 250, unite: 'g', nom: 'farine de seigle' },
      { quantite: 10, unite: 'cl', nom: 'lait' },
      { quantite: 1, unite: 'sachet', nom: 'levure chimique' },
      { quantite: 2, unite: 'c. à c.', nom: 'mélange d’épices (cannelle, anis, gingembre)' },
    ],
    etapes: [
      { texte: 'Tiédir le lait avec le miel jusqu’à ce qu’il soit bien fluide.' },
      { texte: 'Mélanger farine, levure et épices, puis incorporer le lait au miel.' },
      { texte: 'Verser dans un moule à cake beurré et cuire 50 minutes à 160 °C.' },
      { texte: 'Laisser reposer 24 heures enveloppé dans un linge avant de trancher.' },
    ],
    notes: '',
  },
  {
    id: 'r7',
    livreId: 'livre-1',
    titre: 'Vin chaud aux épices',
    categorie: 'Boissons',
    tempsPreparation: 5,
    tempsCuisson: 15,
    portions: 6,
    symbole: 'coupe',
    favori: false,
    ingredients: [
      { quantite: 75, unite: 'cl', nom: 'vin rouge' },
      { quantite: 100, unite: 'g', nom: 'sucre roux' },
      { quantite: 1, unite: '', nom: 'orange non traitée' },
      { quantite: 2, unite: '', nom: 'bâtons de cannelle' },
      { quantite: 2, unite: '', nom: 'étoiles de badiane' },
      { quantite: 3, unite: '', nom: 'clous de girofle' },
    ],
    etapes: [
      { texte: 'Verser le vin dans une casserole avec le sucre, les épices et l’orange en rondelles.' },
      { texte: 'Chauffer doucement 15 minutes sans jamais laisser bouillir.' },
      { texte: 'Filtrer et servir bien chaud.' },
    ],
    notes: '',
  },
  {
    id: 'r8',
    livreId: 'livre-1',
    titre: 'Herbes de Provence maison',
    categorie: 'Autres',
    tempsPreparation: 5,
    tempsCuisson: 0,
    portions: 1,
    symbole: 'feuille',
    favori: false,
    ingredients: [
      { quantite: 3, unite: 'c. à s.', nom: 'thym séché' },
      { quantite: 2, unite: 'c. à s.', nom: 'romarin séché' },
      { quantite: 2, unite: 'c. à s.', nom: 'origan séché' },
      { quantite: 1, unite: 'c. à s.', nom: 'sarriette séchée' },
    ],
    etapes: [
      { texte: 'Émietter les herbes entre les doigts et les mélanger.' },
      { texte: 'Conserver dans un bocal fermé, à l’abri de la lumière.' },
    ],
    notes: 'Se garde un an.',
  },
];

export const recettesFictives: Recette[] = exemples.map((r) => ({ ...r, ...communs, galerie: [], origineId: r.id }));
