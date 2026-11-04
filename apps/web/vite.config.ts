import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const alias = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@kawal/rules': alias('../../packages/rules/src/index.ts'),
      '@kawal/fixtures': alias('../../fixtures/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@kawal/rules', '@kawal/fixtures'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
