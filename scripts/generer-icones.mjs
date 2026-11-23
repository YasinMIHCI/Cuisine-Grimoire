// Génère les icônes PNG de la PWA à partir de public/icones/icone.svg,
// ainsi que l'image d'aperçu affichée quand on partage un lien (apercu.jpg).
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

console.log('Icônes générées.');

// Aperçu des liens partagés (WhatsApp, SMS, réseaux sociaux) : 1200 × 630
const police = readFileSync(
  'node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2',
).toString('base64');
const apercu = await navigateur.newPage({ viewport: { width: 1200, height: 630 } });
await apercu.setContent(
  `<style>
     @font-face { font-family: Fell; src: url(data:font/woff2;base64,${police}) format('woff2'); }
     body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center; gap: 56px;
            background: radial-gradient(ellipse at 30% 40%, #4a2a17, #1d120b 75%); color: #e6c66a; font-family: Fell, serif; }
     .icone { width: 300px; height: 300px; border-radius: 40px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.6); }
     h1 { margin: 0; font-size: 100px; font-weight: 400; line-height: 1.02; }
     p { margin: 18px 0 0; font-size: 34px; color: #ead9b0; font-family: Georgia, serif; font-style: italic; }
   </style>
   <div class="icone">${svg}</div>
   <div><h1>Grimoire<br>de recettes</h1><p>Vos recettes dans un vieux grimoire magique</p></div>`,
);
await apercu.evaluate(() => document.fonts.ready);
// (JPEG : plus léger, et pas mis en cache par l'appli installée qui n'en a pas besoin)
await apercu.screenshot({ path: 'public/icones/apercu.jpg', type: 'jpeg', quality: 85 });
await navigateur.close();

