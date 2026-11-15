import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Polices embarquées (licence libre OFL) : disponibles hors ligne
import '@fontsource/uncial-antiqua/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import './styles/global.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';

// Mise à jour de l'appli installée : dès qu'une nouvelle version est prête,
// la page se recharge toute seule. On vérifie au lancement, puis à chaque
// retour au premier plan (Android garde souvent l'appli ouverte en arrière-plan).
registerSW({
  immediate: true,
  onRegisteredSW(_adresse, enregistrement) {
    if (!enregistrement) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void enregistrement.update();
    });
  },
});

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
