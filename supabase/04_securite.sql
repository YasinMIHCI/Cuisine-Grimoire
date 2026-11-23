-- ============================================================================
-- Grimoire de recettes — sécurité et synchronisation (après l'audit)
-- À coller dans Supabase : SQL Editor → New query → Run. Peut être relancé.
-- Nécessite 01_base.sql, 02_etagere.sql et 03_amis.sql.
--
--  1. Valeurs contrôlées par la base (avatar, couleurs, longueurs…)
--  2. Synchronisation par différence (colonne synchro_le) et horloges déréglées
--  3. Une recette ne peut être rangée que dans un livre de son propriétaire
--  4. Limites des espaces de stockage (taille, types de fichiers)
--  5. Limite de demandes d'amis
--  6. Suppression de son propre compte
-- ============================================================================


-- ============================================== 1. Valeurs contrôlées par la base
-- Les contraintes sont posées « not valid » : elles s'appliquent à toute nouvelle
-- écriture sans bloquer le script si une ancienne ligne ne les respecte pas.

-- Avatar : uniquement une petite image encodée dans le texte (jamais une adresse
-- web, qui permettrait de suivre ceux qui l'affichent).
alter table public.profils drop constraint if exists profils_avatar_image;
alter table public.profils add constraint profils_avatar_image
  check (avatar is null or avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$') not valid;

-- Livres
alter table public.livres drop constraint if exists livres_valeurs;
alter table public.livres add constraint livres_valeurs check (
  length(titre) between 1 and 80
  and couleur_cuir ~ '^#[0-9A-Fa-f]{6}$'
  and symbole in ('chaudron', 'feuille', 'etoile', 'coupe', 'epi', 'flamme', 'poisson', 'lune')
  and (image_couverture is null or image_couverture ~ '^[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$')
  and (transmis_par is null or length(transmis_par) <= 40)
) not valid;

-- Recettes
alter table public.recettes drop constraint if exists recettes_valeurs;
alter table public.recettes add constraint recettes_valeurs check (
  length(titre) between 1 and 200
  and categorie in ('Entrées', 'Plats', 'Desserts', 'Boissons', 'Autres')
  and symbole in ('chaudron', 'feuille', 'etoile', 'coupe', 'epi', 'flamme', 'poisson', 'lune')
  and temps_preparation between 0 and 100000
  and temps_cuisson between 0 and 100000
  and portions between 1 and 999
  and length(notes) <= 10000
  and jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 300
  and jsonb_typeof(etapes) = 'array' and jsonb_array_length(etapes) <= 200
  and jsonb_typeof(galerie) = 'array' and jsonb_array_length(galerie) <= 60
  and octet_length(ingredients::text) + octet_length(etapes::text) <= 300000
  and (photo_principale is null or photo_principale ~ '^[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$')
  and (transmis_par is null or length(transmis_par) <= 40)
) not valid;

-- Titre des envois
alter table public.envois drop constraint if exists envois_titre;
alter table public.envois add constraint envois_titre check (length(titre) <= 200) not valid;


-- ======================================== 2. Synchronisation par différence
-- synchro_le : date (horloge du serveur) de la dernière écriture d'une ligne.
-- L'appli ne demande que les lignes modifiées depuis sa dernière synchronisation.
alter table public.livres add column if not exists synchro_le timestamptz not null default now();
alter table public.recettes add column if not exists synchro_le timestamptz not null default now();
create index if not exists livres_synchro on public.livres (proprietaire_id, synchro_le);
create index if not exists recettes_synchro on public.recettes (proprietaire_id, synchro_le);

-- À chaque écriture :
--  - synchro_le prend l'heure du serveur ;
--  - une date de modification dans le futur (horloge d'appareil en avance) est
--    ramenée à maintenant, pour ne pas l'emporter sur toutes les suivantes ;
--  - une écriture plus ancienne que la version du serveur est ignorée (l'appareil
--    la récupérera à sa prochaine synchronisation).
create or replace function public.dater_ecriture()
returns trigger
language plpgsql
as $$
begin
  if new.modifie_le > now() + interval '1 minute' then
    new.modifie_le := now();
  end if;
  if tg_op = 'UPDATE' and new.modifie_le < old.modifie_le then
    old.synchro_le := clock_timestamp();
    return old;
  end if;
  new.synchro_le := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists ecriture_datee on public.livres;
create trigger ecriture_datee
  before insert or update on public.livres
  for each row execute function public.dater_ecriture();

drop trigger if exists ecriture_datee on public.recettes;
create trigger ecriture_datee
  before insert or update on public.recettes
  for each row execute function public.dater_ecriture();


-- ========================== 3. Une recette dans un livre de son propriétaire
-- (Sans cela, une recette pourrait être rattachée au livre d'un autre compte.)
-- La fonction s'exécute avec les droits de l'appelant : elle ne voit que ses livres.
create or replace function public.verifier_livre_recette()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.livres where id = new.livre_id and proprietaire_id = new.proprietaire_id) then
    raise exception 'Livre introuvable' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists livre_verifie on public.recettes;
create trigger livre_verifie
  before insert or update of livre_id, proprietaire_id on public.recettes
  for each row execute function public.verifier_livre_recette();


-- ===================================================== 4. Espaces de stockage
-- Photos uniquement, 5 Mo au plus (l'appli les compresse à quelques centaines de Ko).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id in ('recettes', 'partages', 'realisations');

create index if not exists envois_par_expediteur on public.envois (expediteur_id, cree_le);


-- ================================================= 5. Limite de demandes d'amis
-- Au plus 30 nouvelles relations par jour et par personne (contre les abus).
create or replace function public.limiter_amities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from amities
      where demandeur_id = new.demandeur_id and cree_le > now() - interval '1 day') >= 30 then
    raise exception 'Trop de demandes d''amis aujourd''hui : réessayez demain.';
  end if;
  return new;
end;
$$;

drop trigger if exists amities_limitees on public.amities;
create trigger amities_limitees
  before insert on public.amities
  for each row execute function public.limiter_amities();


-- ============================================== 6. Suppression de son compte
-- Efface le compte de l'appelant ; toutes ses lignes suivent (« on delete
-- cascade »). Les photos du stockage sont effacées avant par l'appli : le
-- stockage ne peut pas être vidé depuis SQL.
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then
    raise exception 'Connexion nécessaire';
  end if;
  delete from auth.users where id = moi;
end;
$$;

revoke execute on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- Demande à l'API de prendre en compte les changements tout de suite
notify pgrst, 'reload schema';
