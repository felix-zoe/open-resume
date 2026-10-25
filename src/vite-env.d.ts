/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * 环境变量类型。
 *
 * `VITE_SITE_URL` 用于构建期生成 canonical / sitemap / 预渲染 head 里的绝对地址；
 * 未配置时前端回落到 `window.location.origin`（本地开发正确，线上需显式配置）。
 */
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
