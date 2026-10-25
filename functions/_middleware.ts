/**
 * Cloudflare Pages 全局中间件。
 *
 * 职责只有两件，都很窄：
 * 1. 给所有响应加安全响应头（SEC-09）；
 * 2. 对分享页做服务端 OG 注入 —— 微信/LinkedIn/Slack 的爬虫不执行 JS，
 *    只认 HTML 里的 `<meta property="og:*">`，SPA 客户端改 title 对它们无效。
 *
 * 注意：这里刻意**不做**重定向、不做鉴权，避免和 `functions/api/[[route]].ts`
 * 的职责重叠。中间件跑在每个请求上，任何额外开销都是全站成本。
 */

interface Env {
  DB?: D1Database;
}

interface ShareMeta {
  title: string;
  description: string;
  url: string;
  image: string;
}

const SITE_NAME = 'OpenResume';
const DEFAULT_IMAGE_PATH = '/og-default.png';
const CACHE_SECONDS = 300;

/** 只对 HTML 文档注入 CSP；API/静态资源加 CSP 既无意义也容易误伤 */
function securityHeaders(headers: Headers, isHtml: boolean): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  if (isHtml) {
    headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        // Vue 的 :style 绑定会产出内联 style 属性，必须放行 inline 样式
        "style-src 'self' 'unsafe-inline'",
        // data:/blob: 用于头像裁剪后的本地预览，https: 兼容历史外链头像
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join('; ')
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * 把 OG/Twitter 标签注入 HTML。
 *
 * 采用「先删后插」而不是「追加」：index.html 里已有站点级 OG 标签，
 * 直接追加会让爬虫看到两组 og:title（通常取第一个，等于没改）。
 */
export function injectMeta(html: string, meta: ShareMeta): string {
  let out = html;

  // 1. 移除已有的动态标签（title 与 og/twitter 系列）
  out = out.replace(/<title>[\s\S]*?<\/title>/i, '');
  out = out.replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');

  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`,
    `<meta name="robots" content="noindex" />`
  ].join('\n    ');

  return out.replace('</head>', `    ${tags}\n  </head>`);
}

/** 从简历内容里摘一句可读的描述，避免 OG 描述全是空白 */
function describe(content: any, fallbackTitle: string): string {
  const profile = content?.profile ?? {};
  const parts: string[] = [];
  if (profile.title) parts.push(String(profile.title));
  if (profile.workYears) parts.push(String(profile.workYears));
  if (profile.location) parts.push(String(profile.location));

  const summary = typeof profile.summary === 'string' ? profile.summary : '';
  const head = parts.length ? `${parts.join(' · ')}` : '';
  const body = summary || `${fallbackTitle}，点击查看完整在线简历。`;
  return truncate(head ? `${head}｜${body}` : body, 120);
}

function parseJson(raw: unknown): any {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function resolveShareMeta(
  request: Request,
  env: Env
): Promise<ShareMeta | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  const tokenMatch = /^\/s\/([A-Za-z0-9]+)$/.exec(path);
  const idMatch = /^\/share\/([^/]+)$/.exec(path);
  if (!tokenMatch && !idMatch) return null;
  if (!env.DB) return null;

  let row: any = null;
  try {
    if (tokenMatch) {
      row = await env.DB.prepare(
        `SELECT r.title, r.content
           FROM share_links l
           JOIN resumes r ON r.id = l.resume_id
          WHERE l.token = ? AND l.revoked_at IS NULL
            AND (l.expires_at IS NULL OR l.expires_at > unixepoch())`
      ).bind(tokenMatch[1]).first();
    } else {
      row = await env.DB.prepare(
        'SELECT title, content FROM resumes WHERE id = ? AND is_public = 1'
      ).bind(idMatch![1]).first();
    }
  } catch {
    return null;
  }

  if (!row) return null;

  const content = parseJson(row.content);
  const title = `${row.title || '个人简历'} · ${SITE_NAME}`;
  return {
    title,
    description: describe(content, row.title || '个人简历'),
    url: url.origin + path,
    image: url.origin + DEFAULT_IMAGE_PATH
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();
  const headers = new Headers(response.headers);
  const contentType = response.headers.get('Content-Type') || '';
  const isHtml = contentType.includes('text/html');

  securityHeaders(headers, isHtml);

  if (!isHtml) {
    return new Response(response.body, { status: response.status, headers });
  }

  // 只对导航请求做 OG 注入；其他 HTML（例如构建产物里的独立页面）原样返回
  const meta = await resolveShareMeta(context.request, context.env);
  if (!meta) {
    return new Response(response.body, { status: response.status, headers });
  }

  const html = injectMeta(await response.text(), meta);
  headers.delete('Content-Length');
  headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);

  return new Response(html, { status: response.status, headers });
};
