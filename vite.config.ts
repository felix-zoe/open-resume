import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { prerenderPlugin } from './scripts/prerender.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 必须排在 PWA 之前：Workbox 在 closeBundle 里扫磁盘生成预缓存清单
    prerenderPlugin(),
    /**
     * PWA（4.2.13）。
     *
     * 用 `generateSW`（Workbox 自动生成）而不是手写 SW：预缓存清单需要跟着
     * 构建产物的哈希变，手写就得在每次构建后改文件，迟早出错。
     *
     * 缓存策略刻意分两类：
     * · 应用壳与静态资源（JS/CSS/字体/图标）—— precache，离线可用；
     * · `/api/**` —— **不缓存**。简历数据是用户的私有内容，缓存进 SW 会让
     *   换账号后读到上一个人的数据，也让「已保存」状态失去意义。
     *
     * 更新策略用 `prompt` 而不是 `autoUpdate`：编辑器里可能有未保存的内容，
     * 静默刷新会把它冲掉。由 `usePwaUpdate` 弹出「有新版本，刷新以更新」。
     */
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // 开发期不启用 SW：热更新与 SW 缓存打架，调试体验会变得不可预测
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'avatar-placeholder.svg', 'og-default.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'OpenResume 极简简历制作',
        short_name: 'OpenResume',
        description:
          '开源免费的在线简历制作平台：真实 A4 排版、四套模板、浏览器原生打印导出 PDF，可离线编辑。',
        lang: 'zh-CN',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f8fafc',
        theme_color: '#2563eb',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // maskable：图标底铺满画布，系统裁成圆形时不会露白边
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: '新建简历', short_name: '新建', url: '/editor/new' },
          { name: '我的简历', short_name: '工作台', url: '/dashboard' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 单个预缓存文件上限：入口包 ~110KB gzip，1MB 足够覆盖未压缩体积
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        // 分享页与 API 不进 SPA 回退，避免把接口 404 渲染成首页
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // 首次安装立即接管：否则用户首次访问的页面永远不受控，
        // 断网刷新会白屏（要再导航一次才进缓存），与「本地优先」的承诺不符。
        clientsClaim: true,
        // 更新仍需用户确认：编辑器里可能有未保存内容，静默接管会丢数据
        skipWaiting: false,
        runtimeCaching: [
          {
            // 用户上传的头像：网络优先，失败回落到缓存，离线时仍能显示
            urlPattern: /\/api\/file\/.*\.(?:png|jpe?g|webp|gif|svg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'resume-avatars',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
