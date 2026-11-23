// Échanges avec Supabase pour la partie sociale : profil, amis, transmissions,
// réalisations et fil d'activité. Tout ceci demande une connexion à internet
// (contrairement aux livres et recettes, disponibles hors ligne).
import type { PostgrestError } from '@supabase/supabase-js';
import { imagesDe, type Depot } from '../donnees/depot';
import { compresserImage } from '../donnees/images';
import { supabase } from '../donnees/supabase';
import type { ContenuEnvoi, Livre, Recette, RecettePartagee } from '../types';

// ------------------------------------------------------------------- Types

export interface Profil {
  id: string;
  pseudo: string | null;
  /** Petite image encodée en texte (data URL). */
  avatar: string | null;
  codeInvitation: string;
}

export type Relation = 'moi' | 'ami' | 'demande_envoyee' | 'demande_recue' | 'aucune';

/** Ce qu'on peut voir d'un compte trouvé par pseudo ou par lien d'invitation. */
export interface ProfilPublic {
  id: string;
  pseudo: string;
  avatar: string | null;
  relation: Relation;
}

export interface MembreCercle {
  amitieId: string;
  id: string;
  pseudo: string;
  avatar: string | null;
  statut: 'en_attente' | 'acceptee';
  /** « envoyee » : c'est moi qui ai fait la demande. */
  sens: 'envoyee' | 'recue';
}

export type TypeActivite = 'demande_ami' | 'ami_accepte' | 'transmission' | 'transmission_acceptee' | 'realisation';

export interface Activite {
  id: string;
  type: TypeActivite;
  acteurPseudo: string | null;
  details: { titre?: string; type?: 'livre' | 'recette'; origine_id?: string };
  lue: boolean;
  creeLe: string;
}

export interface TransmissionRecue {
  id: string;
  creeLe: string;
  envoiId: string;
  type: 'livre' | 'recette';
  titre: string;
  contenu: ContenuEnvoi;
  expediteurPseudo: string;
}

export interface Realisation {
  id: string;
  origineId: string;
  auteurId: string;
  auteurPseudo: string;
  commentaire: string;
  photoChemin: string;
  creeLe: string;
  /** Adresse temporaire de la photo (valable une heure). */
  adressePhoto: string | null;
}

export interface Compteurs {
  /** Transmissions reçues en attente de réponse. */
  transmissions: number;
  /** Demandes d'amis reçues. */
  demandes: number;
  /** Autres nouveautés non lues (photos, acceptations). */
  nouveautes: number;
}

// --------------------------------------------------------------- Erreurs

/** La base n'a pas encore les tables de l'étape « amis » (supabase/03_amis.sql). */
export class BaseNonAJour extends Error {
  constructor() {
    super('La base de données doit être mise à jour (script supabase/03_amis.sql).');
  }
}

/** Transforme une erreur Supabase en message lisible. */
function verifier(error: PostgrestError | { message: string; code?: string } | null): void {
  if (!error) return;
  const { message, code } = error;
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)) {
    throw new BaseNonAJour();
  }
  throw new Error(traduireErreur(message));
}

export function traduireErreur(message: string): string {
  if (/profils_pseudo_unique|profils_pseudo_key|duplicate key.*pseudo/i.test(message)) return 'Ce pseudo est déjà pris.';
  if (/profils_pseudo_valide/.test(message)) return 'Pseudo invalide : 3 à 20 lettres, chiffres, points, tirets ou « _ ».';
  if (/failed to fetch|network|load failed/i.test(message)) return 'Pas de connexion à internet.';
  if (/row-level security/i.test(message)) return 'Action non autorisée.';
  return message;
}

function client() {
  if (!supabase) throw new Error('Appli non reliée au cloud.');
  if (!navigator.onLine) throw new Error('Pas de connexion à internet.');
  return supabase;
}

// ---------------------------------------------------------------- Profil

/** Pseudo autorisé : 3 à 20 lettres (accents compris), chiffres, « . », « _ », « - ». */
export const MOTIF_PSEUDO = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9_.-]{3,20}$/;

export async function chargerProfil(uid: string): Promise<Profil> {
  const { data, error } = await client()
    .from('profils')
    .select('id, pseudo, avatar, code_invitation')
    .eq('id', uid)
    .maybeSingle();
  verifier(error);
  if (!data) throw new Error('Profil introuvable.');
  return { id: data.id, pseudo: data.pseudo, avatar: data.avatar, codeInvitation: data.code_invitation };
}

export async function enregistrerProfil(uid: string, changements: { pseudo?: string; avatar?: string | null }) {
  const { error } = await client().from('profils').update(changements).eq('id', uid);
  verifier(error);
}

/** Nouveau lien d'invitation (l'ancien ne fonctionne plus). */
export async function changerCodeInvitation(): Promise<string> {
  const { data, error } = await client().rpc('nouveau_code_invitation');
  verifier(error);
  return data as string;
}

/** Réduit une photo en avatar carré de 160 px, encodé en texte. */
export async function creerAvatar(fichier: Blob): Promise<string> {
  const image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  const cote = 160;
  const toile = document.createElement('canvas');
  toile.width = toile.height = cote;
  const c = Math.min(image.width, image.height);
  toile
    .getContext('2d')!
    .drawImage(image, (image.width - c) / 2, (image.height - c) / 2, c, c, 0, 0, cote, cote);
  image.close();
  return toile.toDataURL('image/jpeg', 0.82);
}

// ------------------------------------------------------------------ Amis

/* eslint-disable @typescript-eslint/no-explicit-any */
const versProfilPublic = (x: any): ProfilPublic => ({ id: x.id, pseudo: x.pseudo, avatar: x.avatar, relation: x.relation });

export async function chercherProfil(pseudo: string): Promise<ProfilPublic | null> {
  const { data, error } = await client().rpc('chercher_profil', { p_pseudo: pseudo });
  verifier(error);
  return data?.[0] ? versProfilPublic(data[0]) : null;
}

export async function profilParCode(code: string): Promise<ProfilPublic | null> {
  const { data, error } = await client().rpc('profil_par_code', { p_code: code });
  verifier(error);
  return data?.[0] ? versProfilPublic(data[0]) : null;
}

/** Renvoie : envoyee, acceptee (il nous avait déjà demandé), deja_amis ou en_attente. */
export async function demanderAmi(id: string): Promise<string> {
  const { data, error } = await client().rpc('demander_ami', { p_cible: id });
  verifier(error);
  return data as string;
}

/** Rejoint le cercle de celui qui a partagé son lien. Renvoie : ami, moi ou introuvable. */
export async function accepterInvitation(code: string): Promise<string> {
  const { data, error } = await client().rpc('accepter_invitation', { p_code: code });
  verifier(error);
  return data as string;
}

export async function repondreAmi(amitieId: string, accepte: boolean) {
  const { error } = await client().rpc('repondre_ami', { p_amitie: amitieId, p_accepte: accepte });
  verifier(error);
}

export async function retirerAmi(id: string) {
  const { error } = await client().rpc('retirer_ami', { p_autre: id });
  verifier(error);
}

export async function chargerCercle(): Promise<MembreCercle[]> {
  const { data, error } = await client().rpc('mon_cercle');
  verifier(error);
  return (data ?? []).map((x: any) => ({
    amitieId: x.amitie_id,
    id: x.id,
    pseudo: x.pseudo,
    avatar: x.avatar,
    statut: x.statut,
    sens: x.sens,
  }));
}

// ---------------------------------------------------- Fil et compteurs

export async function chargerActivites(): Promise<Activite[]> {
  const { data, error } = await client()
    .from('activites')
    .select('id, type, acteur_pseudo, details, lue, cree_le')
    .order('cree_le', { ascending: false })
    .limit(60);
  verifier(error);
  return (data ?? []).map((x: any) => ({
    id: x.id,
    type: x.type,
    acteurPseudo: x.acteur_pseudo,
    details: x.details ?? {},
    lue: x.lue,
    creeLe: x.cree_le,
  }));
}

/** Durée de conservation du fil d'activité. */
const CONSERVATION_ACTIVITES = 90 * 24 * 3600 * 1000;

export async function marquerActivitesLues() {
  const sb = client();
  const { error } = await sb.from('activites').update({ lue: true }).eq('lue', false);
  verifier(error);
  // Les vieilles nouvelles (déjà lues) sont effacées
  const limite = new Date(Date.now() - CONSERVATION_ACTIVITES).toISOString();
  await sb.from('activites').delete().eq('lue', true).lt('cree_le', limite);
}

export async function compter(uid: string): Promise<Compteurs> {
  const sb = client();
  const nombre = { count: 'exact', head: true } as const;
  const [transmissions, demandes, nouveautes] = await Promise.all([
    sb.from('transmissions').select('id', nombre).eq('destinataire_id', uid).eq('statut', 'proposee'),
    sb.from('amities').select('id', nombre).eq('destinataire_id', uid).eq('statut', 'en_attente'),
    sb
      .from('activites')
      .select('id', nombre)
      .eq('lue', false)
      .in('type', ['realisation', 'ami_accepte', 'transmission_acceptee']),
  ]);
  verifier(transmissions.error ?? demandes.error ?? nouveautes.error);
  return {
    transmissions: transmissions.count ?? 0,
    demandes: demandes.count ?? 0,
    nouveautes: nouveautes.count ?? 0,
  };
}

// ---------------------------------------------------------- Transmissions

export type SourceEnvoi = { type: 'recette'; recette: Recette } | { type: 'livre'; livre: Livre; recettes: Recette[] };

/** Partie d'une recette qui voyage (sans identifiants ni réglages personnels). */
function versPartagee(r: Recette): RecettePartagee {
  return {
    titre: r.titre,
    categorie: r.categorie,
    tempsPreparation: r.tempsPreparation,
    tempsCuisson: r.tempsCuisson,
    portions: r.portions,
    ingredients: r.ingredients,
    etapes: r.etapes,
    notes: r.notes,
    symbole: r.symbole,
    photoPrincipale: r.photoPrincipale ?? null,
    galerie: r.galerie,
    origineId: r.origineId,
  };
}

/**
 * Transmet un livre ou une recette à des amis : une copie figée est déposée
 * dans le cloud (avec ses photos), puis proposée à chaque destinataire.
 */
export async function transmettre(
  depot: Depot,
  source: SourceEnvoi,
  destinataires: string[],
  progression: (texte: string) => void,
) {
  const sb = client();
  const recettes = source.type === 'recette' ? [source.recette] : source.recettes;
  const contenu: ContenuEnvoi = {
    version: 1,
    recettes: recettes.map(versPartagee),
    ...(source.type === 'livre'
      ? {
          livre: {
            titre: source.livre.titre,
            couleurCuir: source.livre.couleurCuir,
            symbole: source.livre.symbole,
            imageCouverture: source.livre.imageCouverture ?? null,
          },
        }
      : {}),
  };
  const images = [
    ...(source.type === 'livre' && source.livre.imageCouverture ? [source.livre.imageCouverture] : []),
    ...recettes.flatMap(imagesDe),
  ];

  // 1. La copie figée
  const envoiId = crypto.randomUUID();
  const titre = source.type === 'recette' ? source.recette.titre : source.livre.titre;
  progression('Préparation de l’envoi…');
  const { error } = await sb.from('envois').insert({ id: envoiId, type: source.type, titre, contenu });
  verifier(error);

  const deposees: string[] = [];
  try {
    // 2. Ses photos
    for (const [i, id] of images.entries()) {
      progression(`Envoi des photos (${i + 1} / ${images.length})…`);
      const blob = await depot.lireImage(id);
      if (!blob) continue; // photo introuvable : la recette part sans elle
      const chemin = `${envoiId}/${id}`;
      const envoiPhoto = await sb.storage.from('partages').upload(chemin, blob, { contentType: blob.type, upsert: false });
      if (envoiPhoto.error && !/exists|duplicate/i.test(envoiPhoto.error.message)) {
        throw new Error(traduireErreur(envoiPhoto.error.message));
      }
      deposees.push(chemin);
    }

    // 3. Une proposition par ami
    progression('Remise aux destinataires…');
    const { error: erreurTransmissions } = await sb
      .from('transmissions')
      .insert(destinataires.map((id) => ({ envoi_id: envoiId, destinataire_id: id })));
    verifier(erreurTransmissions);
  } catch (erreur) {
    // Envoi raté : on ne laisse rien traîner dans le cloud
    if (deposees.length > 0) await sb.storage.from('partages').remove(deposees);
    await sb.from('envois').delete().eq('id', envoiId);
    throw erreur;
  }
}

/** Délai avant de faire le ménage d'un envoi auquel tous les destinataires ont répondu. */
const DELAI_NETTOYAGE = 24 * 3600 * 1000;

/**
 * Ménage des envois de l'utilisateur : quand tous les destinataires ont
 * répondu (ou qu'il n'y en a aucun), la copie figée et ses photos sont effacées.
 */
export async function nettoyerEnvois(uid: string) {
  const sb = client();
  const limite = new Date(Date.now() - DELAI_NETTOYAGE).toISOString();
  const { data, error } = await sb
    .from('envois')
    .select('id, transmissions(statut)')
    .eq('expediteur_id', uid)
    .lt('cree_le', limite)
    .limit(50);
  verifier(error);
  const termines = (data ?? []).filter((e: any) => !(e.transmissions ?? []).some((t: any) => t.statut === 'proposee'));
  for (const envoi of termines) {
    const { data: fichiers } = await sb.storage.from('partages').list(envoi.id, { limit: 1000 });
    const chemins = (fichiers ?? []).map((f) => `${envoi.id}/${f.name}`);
    if (chemins.length > 0) {
      const { error: erreurPhotos } = await sb.storage.from('partages').remove(chemins);
      if (erreurPhotos) continue; // on réessaiera plus tard
    }
    await sb.from('envois').delete().eq('id', envoi.id);
  }
}

export async function chargerTransmissionsRecues(uid: string): Promise<TransmissionRecue[]> {
  const { data, error } = await client()
    .from('transmissions')
    .select('id, cree_le, envoi:envois(id, type, titre, contenu, expediteur_pseudo)')
    .eq('destinataire_id', uid)
    .eq('statut', 'proposee')
    .order('cree_le', { ascending: false });
  verifier(error);
  return (data ?? [])
    .filter((x: any) => x.envoi)
    .map((x: any) => ({
      id: x.id,
      creeLe: x.cree_le,
      envoiId: x.envoi.id,
      type: x.envoi.type,
      titre: x.envoi.titre,
      contenu: x.envoi.contenu,
      expediteurPseudo: x.envoi.expediteur_pseudo ?? 'Un ami',
    }));
}

/**
 * Accepte une transmission : ses photos sont téléchargées, puis le livre ou la
 * recette est rangé dans la bibliothèque, avec la mention « transmis par ».
 * @returns l'identifiant du livre où la copie a été rangée
 */
export async function accepterTransmission(
  depot: Depot,
  transmission: TransmissionRecue,
  cible: { livreId: string } | { nouveauLivre: string },
  progression: (texte: string) => void,
): Promise<string> {
  const sb = client();
  const { contenu } = transmission;
  const ids = [
    ...(contenu.livre?.imageCouverture ? [contenu.livre.imageCouverture] : []),
    ...contenu.recettes.flatMap((r) => [
      ...(r.photoPrincipale ? [r.photoPrincipale] : []),
      ...r.galerie,
      ...r.etapes.flatMap((e) => (e.image ? [e.image] : [])),
    ]),
  ];
  const images = new Map<string, Blob>();
  for (const [i, id] of ids.entries()) {
    progression(`Réception des photos (${i + 1} / ${ids.length})…`);
    const { data } = await sb.storage.from('partages').download(`${transmission.envoiId}/${id}`);
    if (data) images.set(id, data);
  }
  // La réponse d'abord : si elle échoue (déjà acceptée sur un autre appareil,
  // réseau coupé…), rien n'est rangé, et il n'y aura pas de copie en double.
  const { error } = await sb.rpc('repondre_transmission', { p_id: transmission.id, p_accepte: true });
  verifier(error);
  progression('Rangement dans la bibliothèque…');
  return depot.importer(contenu, images, cible, transmission.expediteurPseudo);
}

export async function refuserTransmission(id: string) {
  const { error } = await client().rpc('repondre_transmission', { p_id: id, p_accepte: false });
  verifier(error);
}

// ------------------------------------------------------------ Réalisations

export async function chargerRealisations(origineId: string): Promise<Realisation[]> {
  const sb = client();
  const { data, error } = await sb
    .from('realisations')
    .select('id, origine_id, auteur_id, auteur_pseudo, commentaire, photo_chemin, cree_le')
    .eq('origine_id', origineId)
    .order('cree_le', { ascending: true });
  verifier(error);
  const lignes = data ?? [];
  // Adresses temporaires des photos, demandées en une fois
  const adresses = new Map<string, string>();
  if (lignes.length > 0) {
    const { data: signees } = await sb.storage
      .from('realisations')
      .createSignedUrls(lignes.map((x: any) => x.photo_chemin), 3600);
    for (const s of signees ?? []) if (s.path && s.signedUrl) adresses.set(s.path, s.signedUrl);
  }
  return lignes.map((x: any) => ({
    id: x.id,
    origineId: x.origine_id,
    auteurId: x.auteur_id,
    auteurPseudo: x.auteur_pseudo ?? 'Un ami',
    commentaire: x.commentaire,
    photoChemin: x.photo_chemin,
    creeLe: x.cree_le,
    adressePhoto: adresses.get(x.photo_chemin) ?? null,
  }));
}

export async function publierRealisation(
  uid: string,
  recette: Pick<Recette, 'origineId' | 'titre'>,
  photo: Blob,
  commentaire: string,
) {
  const sb = client();
  const { blob, extension } = await compresserImage(photo);
  const chemin = `${uid}/${crypto.randomUUID()}.${extension}`;
  const envoiPhoto = await sb.storage.from('realisations').upload(chemin, blob, { contentType: blob.type });
  if (envoiPhoto.error) throw new Error(traduireErreur(envoiPhoto.error.message));
  const { error } = await sb.from('realisations').insert({
    origine_id: recette.origineId,
    titre_recette: recette.titre,
    photo_chemin: chemin,
    commentaire: commentaire.trim().slice(0, 500),
  });
  if (error) {
    await sb.storage.from('realisations').remove([chemin]); // pas de photo orpheline
    verifier(error);
  }
}

export async function supprimerRealisation(realisation: Realisation) {
  const sb = client();
  // La photo d'abord : ensuite, on n'aurait plus le droit de la voir
  await sb.storage.from('realisations').remove([realisation.photoChemin]);
  const { error } = await sb.from('realisations').delete().eq('id', realisation.id);
  verifier(error);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
