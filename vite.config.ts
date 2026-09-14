import { defineConfig } from 'vite';

// Relative base so the build works from any path (or a static file host).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
