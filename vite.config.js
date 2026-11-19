import { defineConfig } from 'vite';

// `base: './'` makes every asset path relative, so the built site works on GitHub Pages
// (https://<user>.github.io/<repo>/) and from any sub-folder without changes.
export default defineConfig({
  base: './',
  server: { open: true },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
