import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Isolated, disposable database per test file (see src/db/index.ts).
    env: {
      DB_PATH: ':memory:',
    },
  },
});
