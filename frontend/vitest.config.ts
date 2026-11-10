import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** Vitest 4 / Vite 8 uses Oxc instead of the removed esbuild JSX setting. */
export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
});
