import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/component/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    restoreMocks: true,
    clearMocks: true,
    css: false
  }
});
