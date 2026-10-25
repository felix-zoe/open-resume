// Cloudflare 边缘环境全局绑定类型

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
  /**
   * 允许跨域访问 API 的来源，逗号分隔（如 `http://localhost:5173`）。
   * 未配置时不放行任何跨域来源；生产环境通常与站点同源，无需设置。
   */
  APP_ORIGIN?: string;
}
