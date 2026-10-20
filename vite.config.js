import { defineConfig } from 'vite';

// Relative Pfade, damit die Seite unter jedem Unterordner funktioniert (z. B. GitHub Pages: /kosmos/)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
