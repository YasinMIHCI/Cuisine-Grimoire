# Grimoire de recettes

Application web de recettes (PWA installable sur Android, iPhone et PC) au style
« vieux grimoire magique ». React + Vite + TypeScript, GSAP, Supabase.

Adresse : https://yasinmihci.github.io/Cuisine-Grimoire/

## Fonctionnalités

- **Intro animée** : le grimoire tombe sur une table de sorcier, s'ouvre, ses pages
  défilent, flash doré (version courte si « animations réduites » est activé).
- **Bibliothèque** : étagère de livres personnalisables (titre, cuir, symbole ou image),
  recettes déplaçables ou copiables d'un livre à l'autre.
- **Livre** : sommaire par catégories, pages qui tournent (swipe, tap), recettes
  paginées automatiquement, photos collées, tap pour agrandir.
- **Recettes** : création et modification, photo principale, galerie, image par étape,
  photos compressées avant envoi.
- **Recherche** par titre et ingrédient (dans un livre ou partout), **favoris** (marque-page
  doré), **portions ajustables**.
- **Mode cuisine** : écran maintenu allumé, gros caractères, étape par étape, minuteurs
  détectés dans le texte, liste de courses.
- **Amis** : pseudo et avatar, ajout par pseudo ou par lien / QR code d'invitation,
  transmission d'un livre ou d'une recette (copie indépendante « transmise par… »),
  photos de réalisations, fil d'activité et pastille de notifications.
- **Hors ligne** : tout est consultable et modifiable sans réseau, synchronisé au retour.
- **Compte** : mot de passe oublié, changement de mot de passe, déconnexion avec effacement
  des données de l'appareil, suppression du compte, page de confidentialité.

Avant d'ouvrir l'appli au public, renseigner l'adresse de contact « données personnelles »
dans `src/composants/Confidentialite.tsx` (`CONTACT_CONFIDENTIALITE`).

Plan, structure du projet et schéma de base de données : [docs/PLAN.md](docs/PLAN.md).
Création du projet Supabase : [docs/SUPABASE.md](docs/SUPABASE.md).

## Lancer en local

```bash
npm install
npm run dev
```

L'adresse « Network » affichée (ex. `http://192.168.1.20:5173`) est accessible depuis un
téléphone connecté au même Wi-Fi. Sans fichier `.env.local`, l'appli fonctionne en mode
local (sans compte, avec un livre d'exemple). L'installation en PWA et le mode hors ligne
demandent du HTTPS : pour cela, tester la version déployée.

## Vérifications

```bash
npm run verifier            # types, règles du code (oxlint) et tests (Vitest)
bash supabase/tests/lancer.sh   # scripts SQL et règles de sécurité (PostgreSQL 16)
```

Elles tournent aussi dans GitHub Actions à chaque push ; le déploiement n'a lieu que si
elles passent.

## Version de production

```bash
npm run build
npm run preview
```

## Déploiement (GitHub Pages)

Chaque push sur `main` déclenche le workflow `.github/workflows/deployer.yml`, qui
vérifie, construit l'appli et la publie sur `https://<compte>.github.io/<dépôt>/`.
À activer une seule fois : Settings → Pages → Source : « GitHub Actions ».
