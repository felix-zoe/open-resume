import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /**
       * `virtual:pwa-register` 是 vite-plugin-pwa 在构建期生成的虚拟模块，
       * 单元测试环境里不存在。指到一个返回空实现的桩，
       * 让 `usePwa.ts` 的 `await import()` 走 catch 分支（正是「浏览器不支持 SW」的降级路径）。
       */
      'virtual:pwa-register': path.resolve(__dirname, './tests/unit/stubs/pwa-register.ts')
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
