/**
 * 页面级 SEO 元数据与结构化数据。
 *
 * SPA 的 `<title>` 与 `<meta>` 在客户端改，搜索引擎能执行 JS 的爬虫（Google）
 * 能读到，但社交平台的链接预览爬虫不执行 JS —— 那部分由
 * `functions/_middleware.ts` 在服务端注入。两者分工：
 * · 这里管「页面切换后的标题/描述/canonical」与结构化数据；
 * · 中间件管「分享链接的 OG」。
 */

export interface PageMeta {
  title: string;
  description?: string;
  /** 相对路径或绝对 URL；默认取当前地址 */
  path?: string;
  /** 是否允许索引；默认允许 */
  indexable?: boolean;
}

const SITE_NAME = 'OpenResume';
const DEFAULT_DESCRIPTION =
  '开源免费的在线简历制作平台：真实 A4 排版、四套专业模板、一键收敛单页、浏览器原生打印导出 PDF，无需注册即可开始。';

/** 站点根地址：构建期注入，缺省取当前 origin（本地开发时正确） */
function siteOrigin(): string {
  const injected = import.meta.env?.VITE_SITE_URL;
  const origin = injected && injected.trim() ? injected.trim().replace(/\/$/, '') : window.location.origin;
  return origin;
}

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

/** 注入或替换一段 JSON-LD；同一 `id` 只保留一份 */
export function setJsonLd(id: string, data: unknown): void {
  let script = document.head.querySelector<HTMLScriptElement>(`script[data-seo="${id}"]`);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seo = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string): void {
  document.head.querySelector(`script[data-seo="${id}"]`)?.remove();
}

/** 应用一次页面元数据；返回一个清理函数（路由切换时用） */
export function applyPageMeta(meta: PageMeta): void {
  const origin = siteOrigin();
  const url = `${origin}${meta.path ?? window.location.pathname}`;
  const title = meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} · ${SITE_NAME}`;
  const description = meta.description || DEFAULT_DESCRIPTION;

  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: meta.indexable === false ? 'noindex, nofollow' : 'index, follow'
  });
  upsertCanonical(url);
}

/**
 * 站点级结构化数据。
 *
 * `SoftwareApplication` 让搜索结果能显示「免费」与评分星标；
 * 只写代码里可验证的事实（免费、开源、浏览器运行），不编造评分。
 */
export function softwareApplicationJsonLd() {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: origin,
    description: DEFAULT_DESCRIPTION,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    isAccessibleForFree: true,
    license: 'https://opensource.org/licenses/MIT',
    featureList: [
      'A4 真实分页预览',
      '四套简历模板',
      '浏览器原生打印导出矢量 PDF',
      '导出 Word / Markdown / JSON',
      'JD 关键词对照',
      '中英双语简历'
    ]
  };
}

/** 首页 FAQ 的结构化数据，与页面上实际展示的问题一一对应 */
export function faqJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  };
}

/** 示例页的 BreadcrumbList：让搜索结果展示层级而不是裸 URL */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`
    }))
  };
}
