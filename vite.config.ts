import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Chemin de base de l'appli : « / » en local, « /<dépôt>/ » sur GitHub Pages
// (fourni par le workflow de déploiement via la variable CHEMIN_BASE).
const cheminBase = process.env.CHEMIN_BASE ?? '/';

// Configuration Vite : React + PWA (manifest, service worker, hors ligne)
export default defineConfig({
  base: cheminBase,
  plugins: [
    react(),
    VitePWA({
      // Le service worker se met à jour tout seul quand une nouvelle version est déployée
      registerType: 'autoUpdate',
      includeAssets: ['icones/icone.svg', 'icones/apple-touch-icon.png'],
      manifest: {
        name: 'Grimoire de recettes',
        short_name: 'Grimoire',
        description: 'Vos recettes de cuisine dans un vieux grimoire magique.',
        lang: 'fr',
        start_url: cheminBase,
        scope: cheminBase,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1d120b',
        theme_color: '#1d120b',
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icones/icone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Tout ce qui compose l'appli est mis en cache pour fonctionner hors ligne
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
