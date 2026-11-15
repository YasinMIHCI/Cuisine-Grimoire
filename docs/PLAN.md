# Grimoire de recettes — plan, structure et schéma

## 1. Étapes

| Étape | Contenu | État |
|---|---|---|
| (a) | Squelette PWA, un livre + sommaire, données fictives | ✅ fait |
| (b) | Pagination automatique des recettes, page tournée (swipe / tap), défilement rapide de pages à l'ouverture d'un chapitre | ✅ fait |
| (c) | Intro : chute du livre, impact, ouverture, zoom, flash (GSAP) + version courte `prefers-reduced-motion` | à faire |
| (d) | Supabase : auth (email + Google), tables + RLS, synchro, cache hors ligne, images compressées | à faire |
| (e) | Étagère : créer / renommer / supprimer / personnaliser les livres, déplacer ou copier une recette | à faire |
| (f) | Profil, amis (pseudo, lien, QR code), transmissions, réalisations, fil d'activité, pastille | à faire |
| (g) | Recherche, favoris, portions ajustables, mode cuisine (Wake Lock) | à faire |

## 2. Choix techniques

- **Animations** : GSAP pilote uniquement `transform` et `opacity` (composités par le GPU)
  pour tenir 60 fps ; pages en CSS 3D (`rotateY`, `backface-visibility`) ; poussière et
  particules sur un petit `<canvas>`.
- **Pagination** : le contenu d'une recette est découpé en blocs (en-tête, ingrédients,
  chaque étape, notes, photos) mesurés hors écran, puis répartis page par page selon la
  hauteur disponible ; recalcul au changement de taille d'écran.
- **Hors ligne** : le service worker met l'appli en cache ; les données vivent dans
  IndexedDB (lecture immédiate), avec une file d'attente des modifications rejouée au
  retour du réseau (la modification la plus récente l'emporte, via `modifie_le`).
- **Images** : redimensionnées côté téléphone (1600 px max, WebP/JPEG ~80 %) avant envoi
  dans Supabase Storage ; vignettes 300 px pour le sommaire.
- **Partage = copie** : accepter une transmission crée une copie indépendante chez le
  destinataire (fonction SQL sécurisée), reliée à l'original par `origine_id` — c'est ce
  lien qui regroupe les « Réalisations » entre amis.
- **Navigation** : `react-router` ajouté à l'étape (d) (liens d'invitation `/invitation/<code>`).

## 3. Structure du projet

```
public/icones/            icônes PWA (SVG source + PNG générés)
scripts/                  génération des icônes
supabase/                 schéma SQL + politiques RLS            (étape d)
src/
  main.tsx, App.tsx
  types.ts                types partagés
  styles/                 styles globaux (parchemin, cuir, typographie)
  donnees/                données fictives, puis accès Supabase + cache local
  utilitaires/            formatage, pagination, compression d'images…
  composants/             Sommaire, Symbole, Ornement…
  livre/                  livre ouvert, pagination, pages qui tournent
  intro/                  animation d'introduction                 (étape c)
  auth/                   connexion, profil                        (étape d)
  bibliotheque/           étagère, couvertures, éditeur de livre   (étape e)
  amis/                   amis, transmissions, réalisations, fil   (étape f)
  cuisine/                mode cuisine                             (étape g)
```

## 4. Schéma de base de données (Supabase / PostgreSQL)

Toutes les tables ont `id uuid` (clé primaire), `cree_le`, et `modifie_le` quand elles
sont synchronisées. Les utilisateurs eux-mêmes sont gérés par `auth.users` (Supabase).

| Table | Colonnes principales | Rôle |
|---|---|---|
| `profils` | `id` → auth.users, `pseudo` (unique, insensible à la casse), `avatar_chemin`, `code_invitation` (unique), `dernier_livre_id` | Profil public minimal |
| `livres` | `proprietaire_id`, `titre`, `couleur_cuir`, `symbole`, `image_couverture`, `position`, `transmis_par` | Livres de l'étagère |
| `recettes` | `livre_id`, `proprietaire_id`, `titre`, `categorie`, `temps_preparation`, `temps_cuisson`, `portions`, `notes`, `favori`, `photo_principale`, `position`, `origine_id`, `transmis_par` | Chapitres d'un livre |
| `ingredients` | `recette_id`, `position`, `quantite`, `unite`, `nom` | Liste d'ingrédients |
| `etapes` | `recette_id`, `position`, `texte`, `image_chemin` | Étapes numérotées |
| `photos_recette` | `recette_id`, `chemin`, `position` | Galerie d'une recette |
| `amities` | `demandeur_id`, `destinataire_id`, `statut` (`en_attente` / `acceptee`), paire unique | Demandes et amitiés |
| `transmissions` | `expediteur_id`, `destinataire_id`, `livre_id` **ou** `recette_id`, `statut` (`proposee` / `acceptee` / `refusee`), `copie_id` | Propositions de partage |
| `realisations` | `origine_id` (recette d'origine), `auteur_id`, `photo_chemin`, `commentaire` | Photos de résultat |
| `activites` | `utilisateur_id` (qui la voit), `acteur_id`, `type`, `recette_id`, `lue` | Fil d'activité + pastille |

`origine_id` : pour une recette créée par l'utilisateur, c'est son propre `id` ; pour une
copie reçue, c'est celui de la recette d'origine. Toutes les copies d'une même recette
partagent donc le même `origine_id`.

Stockage (buckets privés, chemins `<id utilisateur>/…`) : `avatars`, `recettes`, `realisations`.

### Règles de sécurité (RLS)

- `livres`, `recettes`, `ingredients`, `etapes`, `photos_recette` : lecture et écriture
  réservées au propriétaire. Un ami ne lit jamais directement les données d'un autre :
  il reçoit une **copie** lorsqu'il accepte une transmission.
- `profils` : chacun modifie le sien ; lecture de son profil et de ceux de ses amis.
  La recherche par pseudo ou code d'invitation passe par une fonction qui ne renvoie
  que pseudo + avatar.
- `amities` : visibles par les deux personnes ; seul le destinataire accepte ; chacun
  peut supprimer (refuser / retirer un ami).
- `transmissions` : visibles par l'expéditeur et le destinataire ; création seulement
  vers un ami ; l'acceptation passe par la fonction `accepter_transmission(id, livre_cible)`
  qui effectue la copie.
- `realisations` : lisibles par l'auteur et par ses amis qui possèdent une recette de
  même `origine_id` ; suppression par l'auteur uniquement.
- `activites` : lisibles par leur seul destinataire ; créées par des déclencheurs SQL.
- Stockage : lecture/écriture dans son propre dossier ; les photos de réalisation sont
  lisibles selon la même règle que la table `realisations`.
