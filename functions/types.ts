// Cloudflare 边缘环境全局绑定类型

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
}
