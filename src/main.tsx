import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Polices embarquées (licence libre OFL) : disponibles hors ligne
import '@fontsource/uncial-antiqua/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import './styles/global.css';
import { App } from './App';

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
