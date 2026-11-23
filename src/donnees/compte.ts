// Gestion du compte : effacement des données de l'appareil, suppression du compte.
import { supabase } from './supabase';

/** Préfixe des clés de stockage de l'appli (localStorage). */
const PREFIXE = 'grimoire:';
/** Réglages de l'appareil, gardés même quand on efface les données d'un compte. */
const REGLAGES_GARDES = new Set(['grimoire:intro']);

/** Efface tout ce que l'appli garde sur cet appareil pour ce compte. */
export async function effacerDonneesLocales(uid: string) {
  try {
    for (const cle of Object.keys(localStorage)) {
      if (cle.startsWith(PREFIXE) && !REGLAGES_GARDES.has(cle)) localStorage.removeItem(cle);
    }
  } catch {
    // stockage indisponible
  }
  // La suppression attend que la base soit fermée (elle l'est en quittant la bibliothèque)
  await new Promise<void>((resoudre) => {
    const demande = indexedDB.deleteDatabase(`grimoire-${uid}`);
    demande.onsuccess = demande.onerror = () => resoudre();
    demande.onblocked = () => setTimeout(resoudre, 3000);
  });
}

/** Tous les fichiers d'un dossier du stockage (par paquets de 1000). */
async function listerDossier(seau: string, dossier: string): Promise<string[]> {
  const chemins: string[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase!.storage.from(seau).list(dossier, { limit: 1000, offset: page * 1000 });
    if (error) throw error;
    chemins.push(...data.filter((f) => f.id !== null).map((f) => `${dossier}/${f.name}`));
    if (data.length < 1000) return chemins;
  }
}

async function viderDossiers(seau: string, dossiers: string[]) {
  for (const dossier of dossiers) {
    const chemins = await listerDossier(seau, dossier);
    for (let i = 0; i < chemins.length; i += 500) {
      const { error } = await supabase!.storage.from(seau).remove(chemins.slice(i, i + 500));
      if (error) throw error;
    }
  }
}

/**
 * Supprime définitivement le compte : d'abord les photos (le stockage ne se vide
 * pas tout seul), puis le compte lui-même, ce qui efface toutes ses lignes.
 */
export async function supprimerCompte(uid: string, progression: (texte: string) => void) {
  if (!supabase) throw new Error('Appli non reliée au cloud.');
  if (!navigator.onLine) throw new Error('Pas de connexion à internet.');

  progression('Suppression des photos…');
  await viderDossiers('recettes', [uid]);
  await viderDossiers('realisations', [uid]).catch(() => {}); // espace absent si l'étape « amis » n'est pas installée
  const envois = await supabase.from('envois').select('id').eq('expediteur_id', uid);
  if (!envois.error) await viderDossiers('partages', envois.data.map((e) => e.id as string));

  progression('Suppression du compte…');
  const { error } = await supabase.rpc('supprimer_mon_compte');
  if (error) {
    if (/supprimer_mon_compte|schema cache|does not exist/i.test(error.message)) {
      throw new Error('La base doit être mise à jour (script supabase/04_securite.sql) pour pouvoir supprimer un compte.');
    }
    throw new Error(error.message);
  }
  progression('Effacement de cet appareil…');
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  await effacerDonneesLocales(uid);
}
