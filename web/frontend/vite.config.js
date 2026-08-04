import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          preact: ['preact', 'preact/compat', 'preact/hooks'],
          router: ['preact-iso']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:7357',
      '/status.json': 'http://localhost:7357',
      '/inkdrop-logo-mark.png': 'http://localhost:7357'
    }
  }
});