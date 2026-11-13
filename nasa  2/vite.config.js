import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-gsap': ['gsap'],
          'vendor-lenis': ['lenis'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
