-- ============================================================================
-- Grimoire de recettes — schéma de base (étape d)
-- À coller dans Supabase : SQL Editor → New query → Run.
-- Peut être relancé sans risque (tout est en « if not exists » / « or replace »).
-- ============================================================================

-- ---------------------------------------------------------------- Profils
-- Un profil par compte, créé automatiquement à l'inscription.
-- (Pseudo et avatar seront utilisés à l'étape « amis ».)
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text unique,
  avatar_chemin text,
  cree_le timestamptz not null default now()
);

create or replace function public.creer_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists a_la_creation_du_compte on auth.users;
create trigger a_la_creation_du_compte
  after insert on auth.users
  for each row execute function public.creer_profil();

-- ----------------------------------------------------------------- Livres
create table if not exists public.livres (
  id uuid primary key,
  proprietaire_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titre text not null,
  couleur_cuir text not null default '#5a2415',
  symbole text not null default 'chaudron',
  cree_le timestamptz not null default now(),
  -- La modification la plus récente l'emporte lors de la synchronisation
  modifie_le timestamptz not null default now(),
  -- Suppression « douce » : la ligne reste pour prévenir les autres appareils
  supprime_le timestamptz
);

-- --------------------------------------------------------------- Recettes
create table if not exists public.recettes (
  id uuid primary key,
  proprietaire_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  livre_id uuid not null references public.livres (id) on delete cascade,
  titre text not null,
  categorie text not null,
  temps_preparation integer not null default 0,
  temps_cuisson integer not null default 0,
  portions integer not null default 1,
  -- [{ "quantite": 200, "unite": "g", "nom": "farine" }, …]
  ingredients jsonb not null default '[]',
  -- [{ "texte": "…", "image": "<identifiant d'image>" }, …]
  etapes jsonb not null default '[]',
  notes text not null default '',
  favori boolean not null default false,
  symbole text not null default 'chaudron',
  -- Identifiants d'images, rangées dans le stockage sous <id du compte>/<identifiant>
  photo_principale text,
  galerie jsonb not null default '[]',
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  supprime_le timestamptz
);

create index if not exists recettes_par_livre on public.recettes (livre_id);

-- ------------------------------------------------- Règles de sécurité (RLS)
-- Chacun ne voit et ne modifie que ses propres données.
alter table public.profils enable row level security;
alter table public.livres enable row level security;
alter table public.recettes enable row level security;

drop policy if exists "profil : lecture du sien" on public.profils;
create policy "profil : lecture du sien" on public.profils
  for select using (id = auth.uid());

drop policy if exists "profil : modification du sien" on public.profils;
create policy "profil : modification du sien" on public.profils
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "livres : propriétaire seulement" on public.livres;
create policy "livres : propriétaire seulement" on public.livres
  for all using (proprietaire_id = auth.uid()) with check (proprietaire_id = auth.uid());

drop policy if exists "recettes : propriétaire seulement" on public.recettes;
create policy "recettes : propriétaire seulement" on public.recettes
  for all using (proprietaire_id = auth.uid()) with check (proprietaire_id = auth.uid());

-- ------------------------------------------------------ Stockage des images
-- Espace privé « recettes » : chaque compte n'accède qu'à son propre dossier.
insert into storage.buckets (id, name, public)
values ('recettes', 'recettes', false)
on conflict (id) do nothing;

drop policy if exists "images : dossier du propriétaire" on storage.objects;
create policy "images : dossier du propriétaire" on storage.objects
  for all
  using (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text);
