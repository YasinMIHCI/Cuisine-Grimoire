// Génère les icônes PNG de la PWA à partir de public/icones/icone.svg.
// À relancer seulement si l'icône SVG change : npm run icones
// (nécessite Playwright + Chromium, non installés par défaut dans le projet)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// require() permet d'utiliser un Playwright installé globalement (NODE_PATH)
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync('public/icones/icone.svg', 'utf8');
const cibles = [
  { fichier: 'icone-192.png', taille: 192, marge: 0 },
  { fichier: 'icone-512.png', taille: 512, marge: 0 },
  // Icône "maskable" : Android rogne les bords, on garde une marge de sécurité
  { fichier: 'icone-maskable-512.png', taille: 512, marge: 0.12 },
  { fichier: 'apple-touch-icon.png', taille: 180, marge: 0 },
];

const navigateur = await chromium.launch();
for (const { fichier, taille, marge } of cibles) {
  const page = await navigateur.newPage({ viewport: { width: taille, height: taille } });
  const interieur = Math.round(taille * (1 - 2 * marge));
  await page.setContent(
    `<body style="margin:0;background:#1d120b;display:grid;place-items:center;height:100vh">
       <div style="width:${interieur}px;height:${interieur}px">${svg}</div>
     </body>`,
  );
  await page.screenshot({ path: `public/icones/${fichier}` });
  await page.close();
}
await navigateur.close();
console.log('Icônes générées.');
