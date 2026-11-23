# Grimoire de recettes — plan, structure et schéma

## 1. Étapes

| Étape | Contenu | État |
|---|---|---|
| (a) | Squelette PWA, un livre + sommaire, données fictives | ✅ fait |
| (b) | Pagination automatique des recettes, page tournée (swipe / tap), défilement rapide de pages à l'ouverture d'un chapitre | ✅ fait |
| (c) | Intro : chute du livre, impact, ouverture, zoom, flash (GSAP) + version courte `prefers-reduced-motion` | ✅ fait |
| (d) | Supabase : auth (email + Google), tables + RLS, synchro, cache hors ligne, images compressées, formulaire de recette | ✅ fait (à relier au projet Supabase : voir docs/SUPABASE.md) |
| (e) | Étagère : créer / renommer / supprimer / personnaliser les livres, déplacer ou copier une recette | ✅ fait |
| (f) | Profil, amis (pseudo, lien, QR code), transmissions, réalisations, fil d'activité, pastille | ✅ fait (script supabase/03_amis.sql à exécuter) |
| (g) | Recherche, favoris, portions ajustables, mode cuisine (Wake Lock) | ✅ fait |
| (h) | Suites de l'audit : comptes (mot de passe oublié, suppression, confidentialité), sécurité de la base (supabase/04_securite.sql), synchronisation par différence, brouillons, minuteurs persistants, accessibilité, chargement à la demande, tests et CI | ✅ fait (script 04 à exécuter) |

## 2. Choix techniques

- **Animations** : GSAP pilote uniquement `transform` et `opacity` (composités par le GPU)
  pour tenir 60 fps ; pages en CSS 3D (`rotateY`, `backface-visibility`) ; poussière et
  particules sur un petit `<canvas>`.
- **Pagination** : le contenu d'une recette est découpé en blocs (en-tête, ingrédients,
  chaque étape, notes, photos) mesurés hors écran, puis répartis page par page selon la
  hauteur disponible ; recalcul au changement de taille d'écran.
- **Hors ligne** : le service worker met l'appli en cache ; les données vivent dans
  IndexedDB (lecture et écriture immédiates). Chaque modification est marquée « à
  synchroniser » et envoyée au retour du réseau ; la modification la plus récente
  l'emporte (`modifie_le`), et les suppressions sont « douces » (`supprime_le`) pour se
  propager aux autres appareils. La base date chaque écriture avec sa propre horloge
  (`synchro_le`) : l'appli ne demande que les lignes modifiées depuis sa dernière
  synchronisation (et tout, une fois par jour, pour repérer les lignes effacées), page par
  page. Une date venue d'un appareil en avance est ramenée à l'heure du serveur, et une
  écriture plus ancienne que la version du serveur est ignorée.
- **Images** : redimensionnées côté téléphone (1280 px max, WebP ou JPEG à 80 %) avant
  envoi dans Supabase Storage ; gardées sur l'appareil pour la consultation hors ligne.
- **Mode local** : sans configuration Supabase, l'appli fonctionne sans compte.
- **Partage = copie** : accepter une transmission crée une copie indépendante chez le
  destinataire (fonction SQL sécurisée), reliée à l'original par `origine_id` — c'est ce
  lien qui regroupe les « Réalisations » entre amis.
- **Navigation** : gérée par l'historique du navigateur (bouton retour d'Android) ; les
  liens d'invitation seront traités à l'étape (f).

## 3. Structure du projet

```
public/icones/            icônes PWA (SVG source + PNG générés)
scripts/                  génération des icônes
supabase/                 schéma SQL + règles de sécurité (RLS)
src/
  main.tsx, App.tsx
  types.ts                types partagés
  styles/                 styles globaux (parchemin, cuir, typographie)
  donnees/                dépôt local (IndexedDB), synchronisation Supabase, images
  utilitaires/            formatage, pagination, compression d'images…
  composants/             Sommaire, Symbole, Ornement…
  livre/                  livre ouvert, pagination, pages qui tournent
  intro/                  animation d'introduction                 (étape c)
  auth/                   session, écran de connexion
  recette/                formulaire de recette
  bibliotheque/           étagère, éditeur de livre, navigation étagère ↔ livre
  amis/                   profil, amis, transmissions, réalisations, fil, pastille
  cuisine/                mode cuisine, minuteurs
```

## 4. Schéma de base de données (Supabase / PostgreSQL)

Ingrédients, étapes et galerie sont rangés dans la ligne de la recette (colonnes JSON)
plutôt que dans des tables séparées : une recette = une ligne, ce qui rend la
synchronisation hors ligne et la copie lors d'un partage simples et sûres. Les tables
déjà créées sont dans `supabase/01_base.sql` ; celles des amis viendront à l'étape (f).

Toutes les tables ont `id uuid` (clé primaire), `cree_le`, et `modifie_le` quand elles
sont synchronisées. Les utilisateurs eux-mêmes sont gérés par `auth.users` (Supabase).

| Table | Colonnes principales | Rôle |
|---|---|---|
| `profils` | `id` → auth.users, `pseudo` (unique, insensible à la casse), `avatar` (petite image encodée), `code_invitation` (unique) | Profil public minimal |
| `livres` | `proprietaire_id`, `titre`, `couleur_cuir`, `symbole`, `image_couverture`, `position`, `transmis_par` | Livres de l'étagère |
| `recettes` | `livre_id`, `proprietaire_id`, `titre`, `categorie`, `temps_preparation`, `temps_cuisson`, `portions`, `ingredients` (jsonb), `etapes` (jsonb, avec image optionnelle), `notes`, `favori`, `photo_principale`, `galerie` (jsonb), `supprime_le` ; à l'étape (f) : `origine_id`, `transmis_par` | Chapitres d'un livre |
| `amities` | `demandeur_id`, `destinataire_id`, `statut` (`en_attente` / `acceptee`), paire unique | Demandes et amitiés |
| `envois` | `expediteur_id`, `expediteur_pseudo`, `type` (`livre` / `recette`), `titre`, `contenu` (copie figée en JSON) | Ce qui est transmis ; photos dans le stockage `partages/<id>/…` |
| `transmissions` | `envoi_id`, `expediteur_id`, `destinataire_id`, `statut` (`proposee` / `acceptee` / `refusee`) | Une proposition par ami destinataire |
| `realisations` | `origine_id` (recette d'origine), `auteur_id`, `auteur_pseudo`, `titre_recette`, `photo_chemin`, `commentaire` | Photos de résultat |
| `activites` | `destinataire_id` (qui la voit), `acteur_id`, `acteur_pseudo`, `type`, `details`, `lue` | Fil d'activité + pastille (créées par des déclencheurs) |

`origine_id` : pour une recette créée par l'utilisateur, c'est son propre `id` ; pour une
copie reçue, c'est celui de la recette d'origine. Toutes les copies d'une même recette
partagent donc le même `origine_id`.

Stockage (espaces privés) : `recettes` (`<id utilisateur>/…`), `partages` (`<id de l'envoi>/…`), `realisations` (`<id auteur>/…`).

### Règles de sécurité (RLS)

- `livres`, `recettes` : lecture et écriture
  réservées au propriétaire. Un ami ne lit jamais directement les données d'un autre :
  il reçoit une **copie** lorsqu'il accepte une transmission.
- `profils` : chacun modifie le sien ; lecture de son profil et de ceux de ses amis.
  La recherche par pseudo ou code d'invitation passe par une fonction qui ne renvoie
  que pseudo + avatar.
- `amities` : visibles par les deux personnes ; seul le destinataire accepte ; chacun
  peut supprimer (refuser / retirer un ami).
- `envois` / `transmissions` : visibles par l'expéditeur et les destinataires ; création
  seulement vers un ami ; le destinataire répond par `repondre_transmission(id, accepte)`
  et fait lui-même sa copie (photos comprises) dans sa bibliothèque.
- `realisations` : lisibles par l'auteur et par ses amis qui possèdent une recette de
  même `origine_id` ; suppression par l'auteur uniquement.
- `activites` : lisibles par leur seul destinataire ; créées par des déclencheurs SQL.
- Stockage : lecture/écriture dans son propre dossier ; les photos de réalisation sont
  lisibles selon la même règle que la table `realisations`.

## 5. Ajouts au-delà du cahier des charges

- **Lien d'invitation direct** : ouvrir le lien (ou scanner le QR code) d'un ami fait
  rejoindre son cercle sans demande à accepter ; le lien peut être renouvelé.
- **Minuteurs en mode cuisine** : les durées écrites dans les étapes (« 30 minutes »,
  « 1 h 30 ») deviennent des minuteurs, avec sonnerie et vibration ; minuteur libre en plus.
- **Liste de courses** à cocher et à partager (mode cuisine), **recette en texte** à
  envoyer par SMS ou messagerie aux proches qui n'ont pas l'appli.
- **Arrondis naturels** des quantités quand on change le nombre de portions.
- **Pastille sur l'icône** de l'appli installée (là où le système le permet).
- **Geste retour d'Android** : il referme panneaux, image agrandie et mode cuisine avant
  de changer d'écran.
- **Mode dégradé** : tant qu'un script SQL n'est pas exécuté, l'appli continue de
  fonctionner et de synchroniser, et indique quoi faire.

## 6. Tests

- `npm run verifier` : types, oxlint, et tests Vitest des utilitaires (pagination,
  recherche, quantités et fractions, minuteurs) et de la synchronisation (base locale
  simulée, faux Supabase : pagination, différence, conflits, ligne refusée).
- `supabase/tests/lancer.sh` : les scripts sont exécutés deux fois sur PostgreSQL 16 avec
  une imitation des schémas Supabase (`auth`, `storage`), puis 35 vérifications de
  sécurité (ce que chaque compte peut voir ou faire, et ce qui lui est refusé).
- Les deux tournent dans GitHub Actions avant chaque déploiement.
- Parcours complets testés dans Chromium (taille téléphone) : mode local, synchronisation
  avec le vrai projet Supabase, et parcours social à trois comptes sur un serveur local
  imitant Supabase.
