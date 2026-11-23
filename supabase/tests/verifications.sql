-- Vérifications de sécurité des scripts de supabase/ (lancées par lancer.sh).
-- Chaque ligne « ok : … » est une vérification réussie ; la première qui échoue
-- arrête tout.
\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema tests;
grant usage on schema tests to anon, authenticated;

-- La requête doit échouer
create function tests.erreur(requete text, description text) returns void language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    raise notice 'ok : % (%)', description, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC (aucune erreur) : %', description;
end $$;

-- La condition doit être vraie
create function tests.vrai(condition boolean, description text) returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'ÉCHEC : %', description;
  end if;
  raise notice 'ok : %', description;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- Agir en tant qu'un utilisateur (null : visiteur non connecté)
create function tests.connecter(utilisateur uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(utilisateur::text, ''), false);
end $$;

-- Trois comptes : Alice, Bruno, Chloé
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@exemple.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'chloe@exemple.fr');
select tests.vrai((select count(*) from public.profils) = 3, 'un profil est créé pour chaque compte');
update public.profils set pseudo = 'Alice' where id = '00000000-0000-0000-0000-00000000000a';
update public.profils set pseudo = 'Bruno' where id = '00000000-0000-0000-0000-00000000000b';
update public.profils set pseudo = 'Chloe' where id = '00000000-0000-0000-0000-00000000000c';

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set LA '''10000000-0000-0000-0000-00000000000a'''
\set LB '''10000000-0000-0000-0000-00000000000b'''
\set RA '''20000000-0000-0000-0000-00000000000a'''

-- ================================================================ Alice
select tests.connecter(:A);
set role authenticated;

insert into public.livres (id, titre, couleur_cuir, symbole) values (:LA, 'Desserts', '#5a2415', 'lune');
insert into public.recettes (id, livre_id, titre, categorie) values (:RA, :LA, 'Tarte', 'Desserts');
select tests.vrai((select proprietaire_id from public.livres where id = :LA) = :A, 'le propriétaire est fixé par défaut');
select tests.vrai((select origine_id from public.recettes where id = :RA) = :RA, 'une recette créée est sa propre origine');
select tests.vrai((select synchro_le from public.recettes where id = :RA) is not null, 'synchro_le est daté par le serveur');

-- Valeurs contrôlées
select tests.erreur($$update public.profils set avatar = 'https://espion.exemple/pixel.png' where id = auth.uid()$$,
  'un avatar ne peut pas être une adresse web');
update public.profils set avatar = 'data:image/jpeg;base64,AAAA' where id = auth.uid();
select tests.vrai((select avatar from public.profils where id = auth.uid()) like 'data:image/jpeg%', 'un avatar encodé est accepté');
select tests.erreur($$insert into public.livres (id, titre, couleur_cuir) values (gen_random_uuid(), 'X', 'url(https://espion)')$$,
  'la couleur du cuir doit être une couleur');
select tests.erreur($$insert into public.livres (id, titre, symbole) values (gen_random_uuid(), 'X', 'pentacle')$$,
  'le symbole doit être connu');
select tests.erreur($$insert into public.livres (id, titre) values (gen_random_uuid(), repeat('x', 81))$$,
  'le titre d''un livre est limité');
select tests.erreur($$insert into public.recettes (id, livre_id, titre, categorie) values (gen_random_uuid(), '10000000-0000-0000-0000-00000000000a', 'X', 'Poisons')$$,
  'la catégorie doit être connue');
select tests.erreur($$insert into public.recettes (id, livre_id, titre, categorie, portions) values (gen_random_uuid(), '10000000-0000-0000-0000-00000000000a', 'X', 'Plats', 0)$$,
  'au moins une portion');
select tests.erreur($$insert into public.recettes (id, livre_id, titre, categorie, photo_principale) values (gen_random_uuid(), '10000000-0000-0000-0000-00000000000a', 'X', 'Plats', '../autre/photo.jpg')$$,
  'un identifiant de photo ne peut pas sortir de son dossier');

-- Horloges déréglées
update public.recettes set titre = 'Tarte du futur', modifie_le = now() + interval '1 year' where id = :RA;
select tests.vrai((select modifie_le from public.recettes where id = :RA) <= now() + interval '1 minute',
  'une date de modification dans le futur est ramenée à maintenant');
update public.recettes set titre = 'Tarte périmée', modifie_le = now() - interval '1 day' where id = :RA;
select tests.vrai((select titre from public.recettes where id = :RA) = 'Tarte du futur',
  'une écriture plus ancienne que la version du serveur est ignorée');

reset role;

-- ================================================================ Bruno
select tests.connecter(:B);
set role authenticated;
insert into public.livres (id, titre) values (:LB, 'Livre de Bruno');
select tests.vrai((select count(*) from public.livres) = 1, 'Bruno ne voit que ses livres');
select tests.vrai((select count(*) from public.recettes) = 0, 'Bruno ne voit pas les recettes d''Alice');
select tests.erreur($$insert into public.recettes (id, livre_id, titre, categorie) values (gen_random_uuid(), '10000000-0000-0000-0000-00000000000a', 'Intrus', 'Plats')$$,
  'impossible de ranger une recette dans le livre d''un autre');
select tests.erreur($$insert into public.recettes (id, proprietaire_id, livre_id, titre, categorie) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'Intrus', 'Plats')$$,
  'impossible d''écrire au nom d''un autre');
update public.recettes set titre = 'Piratée' where id = :RA;
reset role;
select tests.vrai((select titre from public.recettes where id = :RA) = 'Tarte du futur', 'Bruno ne peut pas modifier la recette d''Alice');
select tests.connecter(:B);
set role authenticated;

-- Transmissions : seulement à un ami
insert into public.envois (id, type, titre, contenu) values ('30000000-0000-0000-0000-00000000000b', 'recette', 'Crêpes', '{"version":1,"recettes":[]}');
select tests.erreur($$insert into public.transmissions (envoi_id, destinataire_id) values ('30000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a')$$,
  'pas de transmission à un inconnu');
select public.demander_ami(:A);
reset role;

select tests.connecter(:A);
set role authenticated;
select public.repondre_ami((select id from public.amities limit 1), true);
select tests.vrai(public.est_ami(:B), 'Alice et Bruno sont amis');
select tests.vrai((select count(*) from public.profils) = 2, 'Alice voit son profil et celui de son ami seulement');
reset role;

select tests.connecter(:B);
set role authenticated;
insert into public.transmissions (envoi_id, destinataire_id) values ('30000000-0000-0000-0000-00000000000b', :A);
select tests.vrai((select count(*) from public.transmissions) = 1, 'transmission à un ami acceptée');
reset role;

select tests.connecter(:C);
set role authenticated;
select tests.vrai((select count(*) from public.envois) = 0, 'Chloé ne voit pas les envois des autres');
select tests.vrai((select count(*) from public.transmissions) = 0, 'Chloé ne voit pas les transmissions des autres');
select tests.vrai((select count(*) from public.chercher_profil('alice')) = 1, 'recherche d''un pseudo (sans tenir compte des majuscules)');
select tests.vrai((select relation from public.chercher_profil('alice')) = 'aucune', 'la recherche indique la relation');
reset role;

-- ================================================== Limite de demandes d'amis
insert into auth.users (id, email)
select ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'compte' || n || '@exemple.fr'
from generate_series(1, 31) n;
update public.profils set pseudo = 'compte' || right(id::text, 2) where id::text like '40000000%';
select tests.connecter(:C);
set role authenticated;
do $$
declare
  n int;
begin
  for n in 1..30 loop
    perform public.demander_ami(('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid);
  end loop;
end $$;
select tests.erreur($$select public.demander_ami('40000000-0000-0000-0000-000000000031')$$, 'au plus 30 demandes d''amis par jour');
reset role;

-- ============================================================== Stockage
select tests.vrai(
  (select bool_and(file_size_limit = 5242880 and allowed_mime_types @> array['image/webp']) from storage.buckets
   where id in ('recettes', 'partages', 'realisations')) and (select count(*) from storage.buckets) = 3,
  'les espaces de stockage limitent la taille et le type des fichiers');
select tests.connecter(:A);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('recettes', '00000000-0000-0000-0000-00000000000a/photo.webp');
select tests.erreur($$insert into storage.objects (bucket_id, name) values ('recettes', '00000000-0000-0000-0000-00000000000b/photo.webp')$$,
  'impossible de déposer une photo dans le dossier d''un autre');
reset role;
select tests.connecter(:B);
set role authenticated;
select tests.vrai((select count(*) from storage.objects) = 0, 'Bruno ne voit pas les photos d''Alice');
reset role;

-- ===================================================== Suppression de compte
select tests.connecter(null);
set role anon;
select tests.erreur($$select public.supprimer_mon_compte()$$, 'un visiteur ne peut rien supprimer');
reset role;
select tests.connecter(:A);
set role authenticated;
select public.supprimer_mon_compte();
reset role;
select tests.vrai(not exists (select 1 from auth.users where id = :A), 'le compte d''Alice est supprimé');
select tests.vrai(not exists (select 1 from public.livres where proprietaire_id = :A)
  and not exists (select 1 from public.recettes where proprietaire_id = :A)
  and not exists (select 1 from public.profils where id = :A)
  and not exists (select 1 from public.amities where :A in (demandeur_id, destinataire_id)),
  'ses livres, recettes, profil et amitiés sont effacés');
select tests.vrai(exists (select 1 from public.livres where proprietaire_id = :B), 'les données de Bruno sont intactes');

\echo 'Toutes les vérifications sont passées.'
