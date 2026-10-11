import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/testSetup.ts'],
    maxWorkers: 4,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
