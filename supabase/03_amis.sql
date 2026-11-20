-- ============================================================================
-- Grimoire de recettes — étape (f) : profils, amis, transmissions, réalisations
-- À coller dans Supabase : SQL Editor → New query → Run.
-- Peut être relancé sans risque. Nécessite 01_base.sql (et 02_etagere.sql).
--
-- Principes de sécurité :
--  - personne ne lit directement les livres ou recettes d'un autre compte ;
--  - une « transmission » est une copie figée (envoi) proposée à un ami, qui en
--    fait sa propre copie s'il l'accepte ;
--  - les photos de réalisations ne sont visibles que de l'auteur et de ses amis
--    qui possèdent la même recette (même « origine ») ;
--  - les fonctions « security definer » vérifient toujours qui appelle (auth.uid()).
-- ============================================================================


-- ============================================================ Recettes, livres
-- origine_id : identifiant de la recette d'origine. Une recette créée a pour
-- origine elle-même ; une copie (reçue ou dupliquée) garde l'origine de l'original.
-- C'est ce lien qui regroupe les « Réalisations » entre amis.
alter table public.recettes add column if not exists origine_id uuid;
alter table public.recettes add column if not exists transmis_par text;
alter table public.livres add column if not exists transmis_par text;
update public.recettes set origine_id = id where origine_id is null;
create index if not exists recettes_par_origine on public.recettes (origine_id);

create or replace function public.completer_origine()
returns trigger
language plpgsql
as $$
begin
  new.origine_id := coalesce(new.origine_id, new.id);
  return new;
end;
$$;

drop trigger if exists origine_par_defaut on public.recettes;
create trigger origine_par_defaut
  before insert or update on public.recettes
  for each row execute function public.completer_origine();


-- ===================================================================== Profils
-- Pseudo unique (sans tenir compte des majuscules), avatar (petite image
-- encodée en texte) et code du lien d'invitation.
alter table public.profils add column if not exists avatar text;
alter table public.profils add column if not exists code_invitation text not null
  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

create unique index if not exists profils_code_unique on public.profils (code_invitation);
create unique index if not exists profils_pseudo_unique on public.profils (lower(pseudo));

alter table public.profils drop constraint if exists profils_pseudo_valide;
alter table public.profils add constraint profils_pseudo_valide
  check (pseudo is null or pseudo ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9_.-]{3,20}$');

alter table public.profils drop constraint if exists profils_avatar_taille;
alter table public.profils add constraint profils_avatar_taille
  check (avatar is null or length(avatar) <= 60000);


-- ===================================================================== Amitiés
create table if not exists public.amities (
  id uuid primary key default gen_random_uuid(),
  demandeur_id uuid not null references auth.users (id) on delete cascade,
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee')),
  cree_le timestamptz not null default now(),
  check (demandeur_id <> destinataire_id)
);

-- Une seule relation par paire de personnes, quel que soit le sens
create unique index if not exists amities_paire
  on public.amities (least(demandeur_id, destinataire_id), greatest(demandeur_id, destinataire_id));

alter table public.amities enable row level security;

drop policy if exists "amities : les deux personnes" on public.amities;
create policy "amities : les deux personnes" on public.amities
  for select using (auth.uid() in (demandeur_id, destinataire_id));
-- (création, acceptation et suppression passent par les fonctions ci-dessous)

-- Vrai si l'utilisateur connecté et « autre » sont amis
create or replace function public.est_ami(autre uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from amities
    where statut = 'acceptee'
      and ((demandeur_id = auth.uid() and destinataire_id = autre)
        or (destinataire_id = auth.uid() and demandeur_id = autre))
  );
$$;

-- Profils lisibles : le sien, et ceux des personnes avec qui on a une relation
drop policy if exists "profil : lecture du sien" on public.profils;
drop policy if exists "profil : lecture du sien et des proches" on public.profils;
create policy "profil : lecture du sien et des proches" on public.profils
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.amities a
      where (a.demandeur_id = auth.uid() and a.destinataire_id = profils.id)
         or (a.destinataire_id = auth.uid() and a.demandeur_id = profils.id)
    )
  );


-- ========================================================== Fil d'activité
create table if not exists public.activites (
  id uuid primary key default gen_random_uuid(),
  -- Celui qui voit l'activité dans son fil
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  -- Celui qui l'a provoquée (pseudo recopié : il reste lisible après une brouille)
  acteur_id uuid references auth.users (id) on delete set null,
  acteur_pseudo text,
  -- demande_ami, ami_accepte, transmission, transmission_acceptee, realisation
  type text not null,
  details jsonb not null default '{}',
  lue boolean not null default false,
  cree_le timestamptz not null default now()
);

create index if not exists activites_par_destinataire on public.activites (destinataire_id, cree_le desc);

alter table public.activites enable row level security;

drop policy if exists "activites : lecture des siennes" on public.activites;
create policy "activites : lecture des siennes" on public.activites
  for select using (destinataire_id = auth.uid());

drop policy if exists "activites : marquer les siennes" on public.activites;
create policy "activites : marquer les siennes" on public.activites
  for update using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());

drop policy if exists "activites : effacer les siennes" on public.activites;
create policy "activites : effacer les siennes" on public.activites
  for delete using (destinataire_id = auth.uid());

-- Ajoute une ligne au fil de quelqu'un (réservé aux déclencheurs ci-dessous)
create or replace function public.noter_activite(p_destinataire uuid, p_acteur uuid, p_type text, p_details jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into activites (destinataire_id, acteur_id, acteur_pseudo, type, details)
  values (p_destinataire, p_acteur, (select pseudo from profils where id = p_acteur), p_type, coalesce(p_details, '{}'));
$$;
revoke execute on function public.noter_activite(uuid, uuid, text, jsonb) from public, anon, authenticated;


-- ======================================================= Fonctions « amis »

-- Refuse l'action si l'utilisateur n'est pas connecté ou n'a pas de pseudo
create or replace function public.verifier_pseudo()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then
    raise exception 'Connexion nécessaire';
  end if;
  if not exists (select 1 from profils where id = moi and pseudo is not null) then
    raise exception 'Choisissez d''abord un pseudo';
  end if;
  return moi;
end;
$$;

-- Recherche d'un profil par pseudo exact (majuscules indifférentes).
-- Ne renvoie que le pseudo et l'avatar : rien d'autre n'est visible d'un inconnu.
create or replace function public.chercher_profil(p_pseudo text)
returns table (id uuid, pseudo text, avatar text, relation text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.pseudo, p.avatar,
    case
      when p.id = auth.uid() then 'moi'
      when a.statut = 'acceptee' then 'ami'
      when a.demandeur_id = auth.uid() then 'demande_envoyee'
      when a.destinataire_id = auth.uid() then 'demande_recue'
      else 'aucune'
    end
  from profils p
  left join amities a
    on (a.demandeur_id = auth.uid() and a.destinataire_id = p.id)
    or (a.destinataire_id = auth.uid() and a.demandeur_id = p.id)
  where auth.uid() is not null
    and p.pseudo is not null
    and lower(p.pseudo) = lower(trim(p_pseudo));
$$;

-- Même chose à partir du code d'un lien d'invitation
create or replace function public.profil_par_code(p_code text)
returns table (id uuid, pseudo text, avatar text, relation text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.pseudo, p.avatar,
    case
      when p.id = auth.uid() then 'moi'
      when a.statut = 'acceptee' then 'ami'
      when a.demandeur_id = auth.uid() then 'demande_envoyee'
      when a.destinataire_id = auth.uid() then 'demande_recue'
      else 'aucune'
    end
  from profils p
  left join amities a
    on (a.demandeur_id = auth.uid() and a.destinataire_id = p.id)
    or (a.destinataire_id = auth.uid() and a.demandeur_id = p.id)
  where auth.uid() is not null
    and p.code_invitation = trim(p_code);
$$;

-- Toutes ses relations : amis, demandes envoyées et reçues
create or replace function public.mon_cercle()
returns table (amitie_id uuid, id uuid, pseudo text, avatar text, statut text, sens text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, p.id, p.pseudo, p.avatar, a.statut,
    case when a.demandeur_id = auth.uid() then 'envoyee' else 'recue' end
  from amities a
  join profils p
    on p.id = case when a.demandeur_id = auth.uid() then a.destinataire_id else a.demandeur_id end
  where auth.uid() in (a.demandeur_id, a.destinataire_id)
  order by lower(p.pseudo);
$$;

-- Demande d'ami. Si l'autre nous avait déjà fait une demande, elle est acceptée.
-- Renvoie : envoyee, acceptee, deja_amis ou en_attente.
create or replace function public.demander_ami(p_cible uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := verifier_pseudo();
  existante amities%rowtype;
begin
  if p_cible = moi then
    raise exception 'Impossible de s''ajouter soi-même';
  end if;
  select * into existante from amities
  where least(demandeur_id, destinataire_id) = least(moi, p_cible)
    and greatest(demandeur_id, destinataire_id) = greatest(moi, p_cible);
  if found then
    if existante.statut = 'acceptee' then
      return 'deja_amis';
    end if;
    if existante.destinataire_id = moi then
      update amities set statut = 'acceptee' where id = existante.id;
      return 'acceptee';
    end if;
    return 'en_attente';
  end if;
  insert into amities (demandeur_id, destinataire_id) values (moi, p_cible);
  return 'envoyee';
end;
$$;

-- Lien d'invitation : celui qui partage son lien accepte d'avance, l'amitié est
-- donc créée directement. Renvoie : ami, moi ou introuvable.
create or replace function public.accepter_invitation(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid := verifier_pseudo();
  hote uuid;
begin
  select id into hote from profils where code_invitation = trim(p_code);
  if hote is null then
    return 'introuvable';
  end if;
  if hote = moi then
    return 'moi';
  end if;
  update amities set statut = 'acceptee'
  where least(demandeur_id, destinataire_id) = least(moi, hote)
    and greatest(demandeur_id, destinataire_id) = greatest(moi, hote);
  if not found then
    insert into amities (demandeur_id, destinataire_id, statut) values (moi, hote, 'acceptee');
  end if;
  return 'ami';
end;
$$;

-- Réponse à une demande reçue
create or replace function public.repondre_ami(p_amitie uuid, p_accepte boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_accepte then
    update amities set statut = 'acceptee'
    where id = p_amitie and destinataire_id = auth.uid() and statut = 'en_attente';
  else
    delete from amities
    where id = p_amitie and destinataire_id = auth.uid() and statut = 'en_attente';
  end if;
  if not found then
    raise exception 'Demande introuvable';
  end if;
end;
$$;

-- Retirer un ami, ou annuler une demande envoyée
create or replace function public.retirer_ami(p_autre uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from amities
  where (demandeur_id = auth.uid() and destinataire_id = p_autre)
     or (destinataire_id = auth.uid() and demandeur_id = p_autre);
$$;

-- Nouveau code d'invitation (l'ancien lien cesse de fonctionner)
create or replace function public.nouveau_code_invitation()
returns text
language sql
security definer
set search_path = public
as $$
  update profils set code_invitation = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  where id = auth.uid()
  returning code_invitation;
$$;

-- Fil d'activité : demandes et acceptations
create or replace function public.activite_amitie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut = 'en_attente' then
      perform noter_activite(new.destinataire_id, new.demandeur_id, 'demande_ami', '{}');
    else
      -- amitié directe par lien d'invitation : on prévient celui qui a invité
      perform noter_activite(new.destinataire_id, new.demandeur_id, 'ami_accepte', '{}');
    end if;
  elsif old.statut = 'en_attente' and new.statut = 'acceptee' then
    perform noter_activite(new.demandeur_id, new.destinataire_id, 'ami_accepte', '{}');
  end if;
  return null;
end;
$$;

drop trigger if exists amitie_notifiee on public.amities;
create trigger amitie_notifiee
  after insert or update of statut on public.amities
  for each row execute function public.activite_amitie();


-- ============================================================ Transmissions
-- Un « envoi » est une copie figée d'un livre ou d'une recette (et ses photos,
-- rangées dans le stockage « partages » sous <id de l'envoi>/…). Une
-- « transmission » le propose à un ami, qui l'accepte ou le refuse.
create table if not exists public.envois (
  id uuid primary key,
  expediteur_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expediteur_pseudo text,
  type text not null check (type in ('livre', 'recette')),
  titre text not null,
  contenu jsonb not null check (octet_length(contenu::text) < 2000000),
  cree_le timestamptz not null default now()
);

create table if not exists public.transmissions (
  id uuid primary key default gen_random_uuid(),
  envoi_id uuid not null references public.envois (id) on delete cascade,
  expediteur_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  statut text not null default 'proposee' check (statut in ('proposee', 'acceptee', 'refusee')),
  cree_le timestamptz not null default now(),
  repondu_le timestamptz,
  unique (envoi_id, destinataire_id)
);

create index if not exists transmissions_par_destinataire on public.transmissions (destinataire_id, statut);

-- Fonctions d'accès (security definer : évitent que les règles des deux tables
-- se renvoient l'une à l'autre)
create or replace function public.est_mon_envoi(p_envoi text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from envois where id::text = p_envoi and expediteur_id = auth.uid());
$$;

create or replace function public.envoi_accessible(p_envoi text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from envois e
    where e.id::text = p_envoi
      and (e.expediteur_id = auth.uid()
        or exists (select 1 from transmissions t where t.envoi_id = e.id and t.destinataire_id = auth.uid()))
  );
$$;

alter table public.envois enable row level security;
alter table public.transmissions enable row level security;

drop policy if exists "envois : expéditeur et destinataires" on public.envois;
create policy "envois : expéditeur et destinataires" on public.envois
  for select using (public.envoi_accessible(id::text));

drop policy if exists "envois : création par l'expéditeur" on public.envois;
create policy "envois : création par l'expéditeur" on public.envois
  for insert with check (expediteur_id = auth.uid());

drop policy if exists "envois : suppression par l'expéditeur" on public.envois;
create policy "envois : suppression par l'expéditeur" on public.envois
  for delete using (expediteur_id = auth.uid());

drop policy if exists "transmissions : expéditeur et destinataire" on public.transmissions;
create policy "transmissions : expéditeur et destinataire" on public.transmissions
  for select using (auth.uid() in (expediteur_id, destinataire_id));

-- On ne transmet qu'à un ami, et que ses propres envois
drop policy if exists "transmissions : vers un ami" on public.transmissions;
create policy "transmissions : vers un ami" on public.transmissions
  for insert with check (
    expediteur_id = auth.uid()
    and statut = 'proposee'
    and public.est_ami(destinataire_id)
    and public.est_mon_envoi(envoi_id::text)
  );

-- Expéditeur et pseudo fixés par la base (impossible de se faire passer pour un autre)
create or replace function public.preparer_envoi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.expediteur_id := auth.uid();
  new.expediteur_pseudo := (select pseudo from profils where id = auth.uid());
  return new;
end;
$$;

drop trigger if exists envoi_prepare on public.envois;
create trigger envoi_prepare
  before insert on public.envois
  for each row execute function public.preparer_envoi();

create or replace function public.preparer_transmission()
returns trigger
language plpgsql
as $$
begin
  new.expediteur_id := auth.uid();
  new.statut := 'proposee';
  new.repondu_le := null;
  return new;
end;
$$;

drop trigger if exists transmission_preparee on public.transmissions;
create trigger transmission_preparee
  before insert on public.transmissions
  for each row execute function public.preparer_transmission();

-- Réponse du destinataire (accepter ou refuser)
create or replace function public.repondre_transmission(p_id uuid, p_accepte boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update transmissions
  set statut = case when p_accepte then 'acceptee' else 'refusee' end,
      repondu_le = now()
  where id = p_id and destinataire_id = auth.uid() and statut = 'proposee';
  if not found then
    raise exception 'Transmission introuvable ou déjà traitée';
  end if;
end;
$$;

-- Fil d'activité : proposition reçue, proposition acceptée
create or replace function public.activite_transmission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  envoi envois%rowtype;
begin
  select * into envoi from envois where id = new.envoi_id;
  if tg_op = 'INSERT' then
    perform noter_activite(new.destinataire_id, new.expediteur_id, 'transmission',
      jsonb_build_object('titre', envoi.titre, 'type', envoi.type, 'transmission_id', new.id));
  elsif old.statut = 'proposee' and new.statut = 'acceptee' then
    perform noter_activite(new.expediteur_id, new.destinataire_id, 'transmission_acceptee',
      jsonb_build_object('titre', envoi.titre, 'type', envoi.type));
  end if;
  return null;
end;
$$;

drop trigger if exists transmission_notifiee on public.transmissions;
create trigger transmission_notifiee
  after insert or update of statut on public.transmissions
  for each row execute function public.activite_transmission();


-- ============================================================= Réalisations
-- Photo d'un plat réalisé, avec un petit commentaire. Rattachée à l'origine de
-- la recette : tous les amis qui en ont une copie la voient.
create table if not exists public.realisations (
  id uuid primary key default gen_random_uuid(),
  origine_id uuid not null,
  auteur_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  auteur_pseudo text,
  titre_recette text,
  -- Chemin dans le stockage « realisations » : <id de l'auteur>/<fichier>
  photo_chemin text not null,
  commentaire text not null default '' check (length(commentaire) <= 500),
  cree_le timestamptz not null default now()
);

create index if not exists realisations_par_origine on public.realisations (origine_id, cree_le);

alter table public.realisations enable row level security;

-- Visible de l'auteur, et de ses amis qui possèdent une recette de même origine
drop policy if exists "realisations : auteur et amis concernés" on public.realisations;
create policy "realisations : auteur et amis concernés" on public.realisations
  for select using (
    auteur_id = auth.uid()
    or (
      public.est_ami(auteur_id)
      and exists (
        select 1 from public.recettes r
        where r.proprietaire_id = auth.uid()
          and r.origine_id = realisations.origine_id
          and r.supprime_le is null
      )
    )
  );

-- On publie sur une recette qu'on possède, avec une photo de son propre dossier
drop policy if exists "realisations : publication" on public.realisations;
create policy "realisations : publication" on public.realisations
  for insert with check (
    auteur_id = auth.uid()
    and photo_chemin like auth.uid()::text || '/%'
    and exists (
      select 1 from public.recettes r
      where r.proprietaire_id = auth.uid() and r.origine_id = realisations.origine_id
    )
  );

drop policy if exists "realisations : suppression par l'auteur" on public.realisations;
create policy "realisations : suppression par l'auteur" on public.realisations
  for delete using (auteur_id = auth.uid());

create or replace function public.preparer_realisation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.auteur_id := auth.uid();
  new.auteur_pseudo := (select pseudo from profils where id = auth.uid());
  return new;
end;
$$;

drop trigger if exists realisation_preparee on public.realisations;
create trigger realisation_preparee
  before insert on public.realisations
  for each row execute function public.preparer_realisation();

-- Fil d'activité : prévient les amis qui ont cette recette
create or replace function public.activite_realisation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activites (destinataire_id, acteur_id, acteur_pseudo, type, details)
  select distinct r.proprietaire_id, new.auteur_id, new.auteur_pseudo, 'realisation',
    jsonb_build_object('origine_id', new.origine_id, 'titre', new.titre_recette, 'realisation_id', new.id)
  from recettes r
  where r.origine_id = new.origine_id
    and r.supprime_le is null
    and r.proprietaire_id <> new.auteur_id
    and exists (
      select 1 from amities a
      where a.statut = 'acceptee'
        and ((a.demandeur_id = new.auteur_id and a.destinataire_id = r.proprietaire_id)
          or (a.destinataire_id = new.auteur_id and a.demandeur_id = r.proprietaire_id))
    );
  return null;
end;
$$;

drop trigger if exists realisation_notifiee on public.realisations;
create trigger realisation_notifiee
  after insert on public.realisations
  for each row execute function public.activite_realisation();


-- ================================================================== Stockage
insert into storage.buckets (id, name, public)
values ('partages', 'partages', false), ('realisations', 'realisations', false)
on conflict (id) do nothing;

-- Photos des envois : déposées par l'expéditeur, lues par lui et les destinataires
drop policy if exists "partages : dépôt par l'expéditeur" on storage.objects;
create policy "partages : dépôt par l'expéditeur" on storage.objects
  for insert with check (bucket_id = 'partages' and public.est_mon_envoi((storage.foldername(name))[1]));

drop policy if exists "partages : lecture expéditeur et destinataires" on storage.objects;
create policy "partages : lecture expéditeur et destinataires" on storage.objects
  for select using (bucket_id = 'partages' and public.envoi_accessible((storage.foldername(name))[1]));

drop policy if exists "partages : suppression par l'expéditeur" on storage.objects;
create policy "partages : suppression par l'expéditeur" on storage.objects
  for delete using (bucket_id = 'partages' and public.est_mon_envoi((storage.foldername(name))[1]));

-- Photos de réalisations : chacun dépose et efface dans son dossier ; lecture
-- selon la même règle que la table « realisations »
drop policy if exists "realisations : dépôt dans son dossier" on storage.objects;
create policy "realisations : dépôt dans son dossier" on storage.objects
  for insert with check (bucket_id = 'realisations' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "realisations : lecture autorisée" on storage.objects;
create policy "realisations : lecture autorisée" on storage.objects
  for select using (
    bucket_id = 'realisations'
    and ((storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.realisations r where r.photo_chemin = objects.name))
  );

drop policy if exists "realisations : suppression dans son dossier" on storage.objects;
create policy "realisations : suppression dans son dossier" on storage.objects
  for delete using (bucket_id = 'realisations' and (storage.foldername(name))[1] = auth.uid()::text);


-- ================================================================= Droits
grant execute on function
  public.est_ami(uuid),
  public.chercher_profil(text),
  public.profil_par_code(text),
  public.mon_cercle(),
  public.demander_ami(uuid),
  public.accepter_invitation(text),
  public.repondre_ami(uuid, boolean),
  public.retirer_ami(uuid),
  public.nouveau_code_invitation(),
  public.repondre_transmission(uuid, boolean),
  public.est_mon_envoi(text),
  public.envoi_accessible(text)
to authenticated;

-- Demande à l'API de prendre en compte les changements tout de suite
notify pgrst, 'reload schema';
