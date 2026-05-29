import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    environment: 'node',
    // jsdom environment is set per-file via @vitest-environment comments
  },
});
