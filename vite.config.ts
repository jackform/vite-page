import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/vite-page/',
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        poster: resolve(__dirname, 'poster.html'),
        code: resolve(__dirname, 'code.html'),
        teacher: resolve(__dirname, 'teacher.html'),
      },
    },
  },
});
