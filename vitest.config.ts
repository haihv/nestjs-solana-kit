import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: '../coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['**/*.ts'],
      exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        '**/*.d.ts',
      ],
    },
  },
  plugins: [swc.vite()],
});
