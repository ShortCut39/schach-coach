import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/index.css';
import './i18n';

import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Element #root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
