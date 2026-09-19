import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// Set BASE_PATH (e.g. "/wortflip/") when deploying under a sub-path such as GitHub Pages.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // The imported vocabulary is a large JSON file: shipping it as a string and
  // parsing it at runtime is faster than evaluating a huge object literal.
  json: { stringify: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // The imported vocabulary gets its own chunk: the app shell stays small,
    // and a data update does not force a re-download of the code (and vice versa).
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'vocabulary', test: /imported\.json$/ }],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new version waits until the user confirms, so an open
      // learning session is never interrupted by a surprise reload.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Wortflip: Deutsch lernen mit Swipe',
        short_name: 'Wortflip',
        description:
          'Deutsch-Wortschatz von A1 bis C1 mit wischbaren Karteikarten lernen. Offline, ohne Anmeldung.',
        lang: 'de',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#FFD84D',
        background_color: '#FFFDF7',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The app shell, the bundled vocabulary and the fonts are all precached,
        // so the app works fully offline after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The vocabulary chunk is above Workbox's default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
