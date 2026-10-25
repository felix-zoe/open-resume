/**
 * 构建期「头部预渲染」。
 *
 * 解决的是 SPA 的一个具体问题：`/examples/frontend` 在浏览器里能正常显示，
 * 但服务器返回的永远是 `index.html`，里面的 `<title>` 是首页标题。
 * Google 会执行 JS 所以问题不大，但**社交平台与部分爬虫不执行 JS**，
 * 它们看到的标题/描述全是首页的，等于每个示例页都在抢同一个摘要。
 *
 * 做法：拿 `dist/index.html` 当模板，给每个营销页写一份带正确 head 的
 * `<path>.html`。Cloudflare Pages 会优先返回静态文件，SPA 回退规则
 * 只兜住其余路由，编辑器与工作台仍然走 SPA。
 *
 * 刻意**不做**完整 SSR：模板组件依赖 ResizeObserver / 打印样式等浏览器 API，
 * 为了几段摘要去搭 SSR 构建链，收益远小于成本。正文由 JS 渲染，
 * 结构化数据与 meta 由这里保证 —— 这两样才是搜索结果里能看见的部分。
 *
 * 以 Vite 插件形式挂在 `vite.config.ts` 里、**排在 PWA 插件之前**：
 * Workbox 的预缓存清单是在 `closeBundle` 里按磁盘上的文件算出来的，
 * 晚于它写出的 HTML 不会被缓存，离线访问示例页就会拿到旧 head。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_NAME = 'OpenResume';
const DEFAULT_ORIGIN = 'https://open-resume.pages.dev';
const DEFAULT_DESCRIPTION =
  '开源免费的在线简历制作平台：真实 A4 排版、四套专业模板、一键收敛单页、浏览器原生打印导出 PDF，无需注册即可开始。';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 与 src/utils/seo.ts 的 applyPageMeta 保持同一套标签，避免客户端接管后跳变 */
function buildHead({ title, description, path: routePath, jsonLd, origin }) {
  const url = `${origin}${routePath}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${origin}/og-default.png" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${origin}/og-default.png" />`
  ];
  if (jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  return tags.join('\n    ');
}

function breadcrumb(items, origin) {
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

/** 先删后插：与 functions/_middleware.ts 的 injectMeta 同一策略 */
function render(template, headTags) {
  let out = template;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, '');
  out = out.replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '');
  out = out.replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');
  return out.replace('</head>', `\n    ${headTags}\n  </head>`);
}

/**
 * 执行预渲染，返回写出的路由列表。
 *
 * @param {{ distDir?: string; origin?: string }} [options]
 */
export function prerender(options = {}) {
  const distDir = options.distDir ?? path.join(ROOT, 'dist');
  const origin = (options.origin ?? process.env.VITE_SITE_URL ?? DEFAULT_ORIGIN).replace(/\/$/, '');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error('找不到 dist/index.html，请先执行 vite build');
  }

  // 只读一次：所有页面都以这份未修改的产物为模板，脚本可以反复执行
  const template = fs.readFileSync(templatePath, 'utf8');
  const written = [];

  const writePage = (routePath, headTags) => {
    const html = render(template, headTags);
    if (routePath === '/') {
      fs.writeFileSync(templatePath, html, 'utf8');
      return routePath;
    }

    const base = path.join(distDir, routePath.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(base), { recursive: true });
    // 平铺的 .html：Cloudflare Pages 的 clean URL 与 `vite preview` 都认
    fs.writeFileSync(`${base}.html`, html, 'utf8');
    // 目录 index.html：兜住静态服务器只查目录索引的情况
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(base, 'index.html'), html, 'utf8');
    return routePath;
  };

  // 首页：head 本来就对，但标题/描述要与客户端 applyPageMeta 一致
  written.push(
    writePage(
      '/',
      buildHead({
        title: `${SITE_NAME} · 在线简历制作与原生 PDF 导出`,
        description: DEFAULT_DESCRIPTION,
        path: '/',
        origin,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_NAME,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: `${origin}/`,
          description: DEFAULT_DESCRIPTION,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          isAccessibleForFree: true
        }
      })
    )
  );

  // 示例库列表
  written.push(
    writePage(
      '/examples',
      buildHead({
        title: `简历示例与写法建议 · ${SITE_NAME}`,
        description:
          '按岗位整理的简历示例：前端、后端、产品、运营、应届生与外企英文简历，每份都带可套用的模板与写法建议。',
        path: '/examples',
        origin,
        jsonLd: breadcrumb(
          [
            { name: '首页', path: '/' },
            { name: '简历示例', path: '/examples' }
          ],
          origin
        )
      })
    )
  );

  // 示例详情：数据源与前端同一份 JSON
  const dataPath = path.join(ROOT, 'src', 'constants', 'examples.data.json');
  const { examples } = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  for (const example of examples) {
    written.push(
      writePage(
        `/examples/${example.slug}`,
        buildHead({
          title: `${example.seoTitle} · ${SITE_NAME}`,
          description: example.description,
          path: `/examples/${example.slug}`,
          origin,
          jsonLd: breadcrumb(
            [
              { name: '首页', path: '/' },
              { name: '简历示例', path: '/examples' },
              { name: example.name, path: `/examples/${example.slug}` }
            ],
            origin
          )
        })
      )
    );
  }

  // 法律页：内容由前端渲染，这里只保证标题正确
  for (const [route, title, description] of [
    ['/privacy', `隐私政策 · ${SITE_NAME}`, 'OpenResume 收集哪些数据、如何使用与保存，以及你享有的权利。'],
    ['/terms', `服务条款 · ${SITE_NAME}`, '使用 OpenResume 的服务条款，包括账号、内容归属与责任范围。']
  ]) {
    written.push(writePage(route, buildHead({ title, description, path: route, origin })));
  }

  return { origin, written };
}

/**
 * Vite 插件：在 `closeBundle` 里执行，排位在 PWA 插件之前，
 * 这样 Workbox 扫描磁盘时会包含预渲染产物。
 */
export function prerenderPlugin() {
  return {
    name: 'open-resume:prerender',
    apply: 'build',
    closeBundle() {
      const { origin, written } = prerender();
      console.log(`\n✅ 预渲染 ${written.length} 个页面：`);
      for (const route of written) console.log(`   ${origin}${route}`);
    }
  };
}

// 直接执行（npm run prerender）时跑一次
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { origin, written } = prerender();
  console.log(`✅ 预渲染 ${written.length} 个页面：`);
  for (const route of written) console.log(`   ${origin}${route}`);
}
