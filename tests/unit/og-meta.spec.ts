import { describe, expect, it } from 'vitest';
import { injectMeta } from '../../functions/_middleware';

const BASE_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>OpenResume - 极简智能简历制作平台</title>
    <meta property="og:title" content="站点默认标题" />
    <meta property="og:description" content="站点默认描述" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="https://open-resume.pages.dev/" />
  </head>
  <body><div id="app"></div></body>
</html>`;

const META = {
  title: '前端工程师-张小凡 · OpenResume',
  description: '资深前端工程师 · 5 年经验｜熟悉 Vue 3 与 TypeScript',
  url: 'https://open-resume.pages.dev/s/abc234',
  image: 'https://open-resume.pages.dev/og-default.png'
};

describe('injectMeta', () => {
  it('替换站点默认 title，只保留一个 <title>', () => {
    const html = injectMeta(BASE_HTML, META);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain('<title>前端工程师-张小凡 · OpenResume</title>');
    expect(html).not.toContain('极简智能简历制作平台');
  });

  it('移除旧的 og:title，避免爬虫取到第一条', () => {
    const html = injectMeta(BASE_HTML, META);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html).toContain('content="前端工程师-张小凡 · OpenResume"');
    expect(html).not.toContain('站点默认标题');
  });

  it('写入 og:image / og:url / twitter:card', () => {
    const html = injectMeta(BASE_HTML, META);
    expect(html).toContain('property="og:image" content="https://open-resume.pages.dev/og-default.png"');
    expect(html).toContain('property="og:url" content="https://open-resume.pages.dev/s/abc234"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('分享页不索引：注入 robots noindex', () => {
    const html = injectMeta(BASE_HTML, META);
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  it('标题中的特殊字符被转义，不会破坏标签结构', () => {
    const html = injectMeta(BASE_HTML, {
      ...META,
      title: '<script>alert(1)</script>',
      description: '"引号" & 与号'
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;引号&quot;');
  });

  it('canonical 只保留注入的那一条', () => {
    const html = injectMeta(BASE_HTML, META);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('href="https://open-resume.pages.dev/s/abc234"');
  });

  it('标签插在 </head> 之前，而不是文档末尾', () => {
    const html = injectMeta(BASE_HTML, META);
    const headEnd = html.indexOf('</head>');
    expect(html.indexOf('og:title')).toBeLessThan(headEnd);
  });
});
