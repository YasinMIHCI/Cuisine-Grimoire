# Grimoire de recettes

Application web de recettes (PWA installable) au style « vieux grimoire magique ».
React + Vite + TypeScript, GSAP, Supabase.

Plan, structure du projet et schéma de base de données : [docs/PLAN.md](docs/PLAN.md).

## Lancer en local

```bash
npm install
npm run dev
```

L'adresse « Network » affichée (ex. `http://192.168.1.20:5173`) est accessible depuis un
téléphone connecté au même Wi-Fi. L'installation en PWA et le mode hors ligne demandent
du HTTPS : pour cela, tester la version déployée.

## Version de production

```bash
npm run build
npm run preview
```

## Déploiement (GitHub Pages)

Chaque push sur `main` déclenche le workflow `.github/workflows/deployer.yml`, qui
construit l'appli et la publie sur `https://<compte>.github.io/<dépôt>/`.
À activer une seule fois : Settings → Pages → Source : « GitHub Actions ».
