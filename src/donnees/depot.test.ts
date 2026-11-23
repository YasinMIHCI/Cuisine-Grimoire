// Synchronisation du dépôt, avec une base locale simulée (fake-indexeddb)
// et un faux Supabase en mémoire.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Ligne = Record<string, unknown> & { id: string };

/** Faux serveur : deux tables et un espace de stockage. */
const serveur = {
  tables: { livres: new Map<string, Ligne>(), recettes: new Map<string, Ligne>() } as Record<string, Map<string, Ligne>>,
  fichiers: new Map<string, Blob>(),
  horloge: 1_000_000,
  /** Lignes refusées (comme une contrainte de la base). */
  refuser: (_l: Ligne) => false,
  requetes: [] as string[],
};

function requeteSelect(table: string) {
  let depuis: string | null = null;
  const q = {
    gt(_col: string, valeur: string) {
      depuis = valeur;
      return q;
    },
    order() {
      return q;
    },
    async range(debut: number, fin: number) {
      serveur.requetes.push(`${table}:${depuis ? 'diff' : 'tout'}:${debut}`);
      const lignes = [...serveur.tables[table].values()]
        .filter((l) => !depuis || String(l.synchro_le) > depuis)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(debut, fin + 1);
      return { data: structuredClone(lignes), error: null };
    },
  };
  return q;
}

vi.mock('./supabase', () => ({
  UID_LOCAL: 'local',
  SEAU_IMAGES: 'recettes',
  supabase: {
    from: (table: string) => ({
      select: () => requeteSelect(table),
      async upsert(lignes: Ligne | Ligne[]) {
        const liste = Array.isArray(lignes) ? lignes : [lignes];
        if (liste.some((l) => serveur.refuser(l))) return { error: { code: '23514', message: 'check violation' } };
        for (const l of liste) {
          serveur.horloge += 1000;
          serveur.tables[table].set(l.id, { ...l, synchro_le: new Date(serveur.horloge).toISOString() });
        }
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        async upload(chemin: string, blob: Blob) {
          serveur.fichiers.set(chemin, blob);
          return { error: null };
        },
        async remove(chemins: string[]) {
          chemins.forEach((c) => serveur.fichiers.delete(c));
          return { error: null };
        },
        async download(chemin: string) {
          return { data: serveur.fichiers.get(chemin) ?? null, error: null };
        },
      }),
    },
  },
}));

const { Depot } = await import('./depot');

const UID = 'compte-1';
let numeroBase = 0;

/** Ouvre un dépôt sur une base locale neuve (un « appareil »). */
async function appareil() {
  numeroBase++;
  return Depot.ouvrir(`${UID}-${numeroBase}`).then((d) => Object.assign(d, { uid: UID }) as typeof d);
}

function recetteServeur(id: string, livreId: string, titre: string, modifieLe = '2026-01-01T00:00:00.000Z'): Ligne {
  serveur.horloge += 1000;
  return {
    id, proprietaire_id: UID, livre_id: livreId, titre, categorie: 'Plats',
    temps_preparation: 0, temps_cuisson: 0, portions: 4, ingredients: [], etapes: [], notes: '',
    favori: false, symbole: 'chaudron', photo_principale: null, galerie: [], origine_id: id,
    cree_le: modifieLe, modifie_le: modifieLe, supprime_le: null,
    synchro_le: new Date(serveur.horloge).toISOString(),
  };
}

function livreServeur(id: string, titre = 'Livre'): Ligne {
  serveur.horloge += 1000;
  return {
    id, proprietaire_id: UID, titre, couleur_cuir: '#5a2415', symbole: 'chaudron',
    cree_le: '2026-01-01T00:00:00.000Z', modifie_le: '2026-01-01T00:00:00.000Z', supprime_le: null,
    synchro_le: new Date(serveur.horloge).toISOString(),
  };
}

beforeEach(() => {
  serveur.tables.livres.clear();
  serveur.tables.recettes.clear();
  serveur.fichiers.clear();
  serveur.refuser = () => false;
  serveur.requetes = [];
  vi.stubGlobal('navigator', { onLine: true });
});

describe('synchronisation', () => {
  it('crée un premier livre pour un nouveau compte et l’envoie', async () => {
    const d = await appareil();
    await d.synchroniser();
    expect(d.lireEtat().livres).toHaveLength(1);
    expect(serveur.tables.livres.size).toBe(1);
    expect(d.lireEtat().synchro).toBe('a-jour');
  });

  it('récupère plus de 1000 recettes (pagination)', async () => {
    serveur.tables.livres.set('L', livreServeur('L'));
    for (let i = 0; i < 1203; i++) {
      const id = `r-${String(i).padStart(5, '0')}`;
      serveur.tables.recettes.set(id, recetteServeur(id, 'L', `Recette ${i}`));
    }
    const d = await appareil();
    await d.synchroniser();
    expect(d.lireEtat().recettes).toHaveLength(1203);
  });

  it('ne demande ensuite que les lignes modifiées', async () => {
    serveur.tables.livres.set('L', livreServeur('L'));
    serveur.tables.recettes.set('r1', recetteServeur('r1', 'L', 'Soupe'));
    const d = await appareil();
    await d.synchroniser();
    serveur.requetes = [];
    serveur.tables.recettes.set('r2', recetteServeur('r2', 'L', 'Gratin'));
    await d.synchroniser();
    expect(serveur.requetes).toEqual(['livres:diff:0', 'recettes:diff:0']);
    expect(d.lireEtat().recettes.map((r) => r.titre).sort()).toEqual(['Gratin', 'Soupe']);
  });

  it('propage une modification d’un appareil à l’autre', async () => {
    const telephone = await appareil();
    await telephone.synchroniser();
    const livre = telephone.lireEtat().livres[0];
    const ordinateur = await appareil();
    await ordinateur.synchroniser();

    const recette = await telephone.enregistrerRecette({
      livreId: livre.id, titre: 'Crêpes', categorie: 'Desserts', tempsPreparation: 10, tempsCuisson: 20,
      portions: 4, ingredients: [], etapes: [], notes: '', favori: false, symbole: 'lune', galerie: [],
    });
    await telephone.synchroniser();
    await ordinateur.synchroniser();
    expect(ordinateur.lireEtat().recettes.map((r) => r.titre)).toEqual(['Crêpes']);

    await ordinateur.supprimerRecette(recette.id);
    await ordinateur.synchroniser();
    await telephone.synchroniser();
    expect(telephone.lireEtat().recettes).toHaveLength(0);
  });

  it('garde une modification locale plus récente que celle du serveur', async () => {
    serveur.tables.livres.set('L', livreServeur('L'));
    serveur.tables.recettes.set('r1', recetteServeur('r1', 'L', 'Ancienne', '2020-01-01T00:00:00.000Z'));
    const d = await appareil();
    await d.synchroniser();
    const r = d.lireEtat().recettes[0];
    await d.enregistrerRecette({ ...r, titre: 'Nouvelle' });
    await d.synchroniser();
    expect(serveur.tables.recettes.get('r1')?.titre).toBe('Nouvelle');
  });

  it('une ligne refusée par le serveur ne bloque pas les autres', async () => {
    const d = await appareil();
    await d.synchroniser();
    const livreId = d.lireEtat().livres[0].id;
    const base = {
      livreId, categorie: 'Plats' as const, tempsPreparation: 0, tempsCuisson: 0, portions: 1,
      ingredients: [], etapes: [], notes: '', favori: false, symbole: 'chaudron' as const, galerie: [],
    };
    serveur.refuser = (l) => l.titre === 'Trop longue';
    await d.enregistrerRecette({ ...base, titre: 'Correcte' });
    await d.enregistrerRecette({ ...base, titre: 'Trop longue' });
    await d.synchroniser();
    expect([...serveur.tables.recettes.values()].map((r) => r.titre)).toEqual(['Correcte']);
    expect(d.lireEtat().synchro).toBe('erreur');
    expect(d.lireEtat().erreur).toContain('Trop longue');
    expect(await d.nombreEnAttente()).toBe(1);
  });

  it('efface les photos d’un formulaire abandonné, sauf celles utilisées', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    const d = await appareil();
    await d.synchroniser();
    const livreId = d.lireEtat().livres[0].id;
    // (pas de canvas ici : on range les images telles quelles)
    const gardee = await d.stockerImage(new Blob(['a'], { type: 'image/webp' }), 'webp');
    const abandonnee = await d.stockerImage(new Blob(['b'], { type: 'image/webp' }), 'webp');
    await d.enregistrerRecette({
      livreId, titre: 'Avec photo', categorie: 'Plats', tempsPreparation: 0, tempsCuisson: 0, portions: 1,
      ingredients: [], etapes: [], notes: '', favori: false, symbole: 'chaudron', galerie: [], photoPrincipale: gardee,
    });
    await d.abandonnerImages([gardee, abandonnee]);
    expect(await d.lireImage(gardee)).not.toBeNull();
    expect(await d.lireImage(abandonnee)).toBeNull();
  });
});
