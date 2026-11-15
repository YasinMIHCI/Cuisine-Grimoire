// Connexion à Supabase (authentification, base de données, stockage des images).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const adresse = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clePublique = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Client Supabase, ou `null` si l'appli n'est pas configurée (fichier .env absent).
 * Dans ce cas l'appli fonctionne en « mode local » : sans compte, les données
 * restent sur l'appareil.
 */
export const supabase: SupabaseClient | null =
  adresse && clePublique
    ? createClient(adresse, clePublique, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

/** Identifiant utilisé en mode local, à la place d'un identifiant de compte. */
export const UID_LOCAL = 'local';

/** Nom de l'espace de stockage des images de recettes. */
export const SEAU_IMAGES = 'recettes';
