import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@kawal/rules': alias('./packages/rules/src/index.ts'),
      '@kawal/fixtures': alias('./fixtures/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'apps/**/test/**/*.test.ts',
      'apps/**/test/**/*.test.tsx',
      'packages/**/test/**/*.test.ts',
      'packages/**/test/**/*.test.tsx',
      'fixtures/test/**/*.test.ts',
    ],
  },
});
