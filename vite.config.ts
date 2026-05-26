import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/vite-page/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        poster: resolve(__dirname, 'poster.html'),
        code: resolve(__dirname, 'code.html'),
      },
    },
  },
});
