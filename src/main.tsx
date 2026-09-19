import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

// The app moved to wortflip.de. Visitors (and installed copies) on the old Netlify
// address are sent over here, in the page instead of on the server, so that the
// old service worker can still update and then let go.
const OLD_HOST = 'wortflip.netlify.app';
const NEW_ORIGIN = 'https://wortflip.de';
if (window.location.hostname === OLD_HOST) {
  const target = `${NEW_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  const cleanup = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations().then((list) => Promise.all(list.map((r) => r.unregister())))
    : Promise.resolve();
  void cleanup.finally(() => window.location.replace(target));
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
