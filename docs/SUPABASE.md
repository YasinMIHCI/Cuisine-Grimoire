# Créer le projet Supabase (gratuit)

Tant que ces étapes ne sont pas faites, l'appli fonctionne en **mode local** : sans
compte, les recettes restent sur l'appareil.

## 1. Créer le projet

1. Aller sur https://supabase.com et créer un compte (« Start your project »).
2. « New project » : donner un nom (ex. `grimoire`), choisir un mot de passe de base de
   données (à conserver), et une région proche (ex. *West EU (Paris)*). Formule **Free**.
3. Attendre une à deux minutes que le projet soit prêt.

## 2. Créer les tables et les règles de sécurité

1. Menu de gauche : **SQL Editor** → « New query ».
2. Copier tout le contenu du fichier [`supabase/01_base.sql`](../supabase/01_base.sql),
   le coller, puis cliquer sur **Run**. Le résultat doit être « Success ».

3. Faire de même avec [`supabase/02_etagere.sql`](../supabase/02_etagere.sql) (image de
   couverture des livres), puis avec [`supabase/03_amis.sql`](../supabase/03_amis.sql)
   (profils, amis, transmissions, réalisations, fil d'activité).

Les scripts peuvent être relancés sans risque. Tant que le troisième n'est pas exécuté,
l'appli fonctionne normalement mais le « Cercle des amis » affiche qu'une mise à jour de
la base est nécessaire.

Le premier script crée les tables `profils`, `livres`, `recettes`, l'espace de stockage privé
`recettes` pour les photos, et les règles qui font que chacun ne voit que ses données.

## 3. Indiquer l'adresse de l'appli

Menu **Authentication** → **URL Configuration** :

- **Site URL** : `https://yasinmihci.github.io/Cuisine-Grimoire/` (c'est aussi l'adresse
  des liens d'invitation envoyés à vos amis)
- **Redirect URLs** → « Add URL » : la même adresse, puis `http://localhost:5173/`
  (pour les tests sur ordinateur).

## 4. Connexion par e-mail

Elle est activée par défaut. Par défaut aussi, un nouveau compte doit cliquer sur un
lien reçu par e-mail avant de pouvoir se connecter. Pour simplifier les essais, on peut
désactiver cette confirmation : **Authentication** → **Sign In / Providers** → **Email**
→ décocher « Confirm email ».

## 5. Connexion Google (facultatif, peut se faire plus tard)

1. Dans Supabase : **Authentication** → **Sign In / Providers** → **Google**. Garder la
   page ouverte et copier l'adresse « Callback URL » affichée
   (`https://<projet>.supabase.co/auth/v1/callback`).
2. Aller sur https://console.cloud.google.com, créer un projet, puis
   **API et services** → **Écran de consentement OAuth** (type « Externe », nom de
   l'appli et e-mail de contact suffisent).
3. **Identifiants** → « Créer des identifiants » → **ID client OAuth** → type
   « Application Web ». Dans « URI de redirection autorisés », coller la Callback URL.
4. Copier l'**ID client** et le **code secret** obtenus dans la page Google de Supabase,
   activer le fournisseur, enregistrer.

Sans cette étape, le bouton « Continuer avec Google » affiche une erreur ; la connexion
par e-mail fonctionne quand même.

## 6. Relier l'appli au projet

Dans Supabase : **Project Settings** → **API Keys** (et **Data API** pour l'adresse).
Deux valeurs sont nécessaires :

- **Project URL** : `https://xxxxxxxx.supabase.co`
- la clé **anon** / **publishable** (une longue chaîne de caractères).

Ces deux valeurs sont faites pour être publiques (ce sont les règles de sécurité qui
protègent les données). **Ne jamais partager la clé `service_role` / « secret ».**

Elles vont dans un fichier `.env.production` à la racine du projet :

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Une fois ce fichier poussé sur `main`, l'appli déployée demande de se connecter.

## À savoir sur la formule gratuite

- Un projet sans activité pendant une semaine est mis en pause ; il se relance d'un clic
  depuis le tableau de bord (les données sont conservées).
- 500 Mo de base de données et 1 Go de photos : largement suffisant ici, les photos
  étant compressées (100 à 300 Ko chacune).
