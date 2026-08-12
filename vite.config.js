import { defineConfig } from 'vite';

// Keep the current public/ layout during the migration. This lets us adopt
// Vite's build pipeline without changing the existing HTML/CSS/JS runtime.
export default defineConfig({
  root: 'public',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4173',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
