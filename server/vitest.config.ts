import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    setupFiles: ['./tests/setup.ts'],
    // Run unit tests first, then integration
    include: ['tests/**/*.test.ts'],
  },
});
