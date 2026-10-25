import { afterEach, describe, expect, it } from 'vitest';
import {
  applyPageMeta,
  breadcrumbJsonLd,
  faqJsonLd,
  removeJsonLd,
  setJsonLd,
  softwareApplicationJsonLd
} from '../../src/utils/seo';
import { RESUME_EXAMPLES, buildExampleContent, findExample } from '../../src/constants/examples';

afterEach(() => {
  document.head
    .querySelectorAll('meta[name="description"], meta[name="robots"], link[rel="canonical"], script[data-seo]')
    .forEach((el) => el.remove());
  document.title = '';
});

describe('示例数据', () => {
  it('slug 唯一，否则后一条会覆盖前一条的页面', () => {
    const slugs = RESUME_EXAMPLES.map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('每条都有完整可索引文案', () => {
    for (const example of RESUME_EXAMPLES) {
      expect(example.seoTitle.length).toBeGreaterThan(8);
      expect(example.description.length).toBeGreaterThan(20);
      expect(example.highlights.length).toBeGreaterThanOrEqual(3);
      expect(example.tips.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('英文示例使用英文简历数据，中文示例使用中文数据', () => {
    expect(buildExampleContent(findExample('frontend')!).profile.name).toBe('张小凡');
    expect(buildExampleContent(findExample('foreign-company')!).profile.name).toBe('Alex Zhang');
  });

  it('示例内容只替换求职意向，不污染共享的默认范文', () => {
    const before = buildExampleContent(findExample('frontend')!);
    const other = buildExampleContent(findExample('backend')!);

    expect(before.profile.title).toBe('前端工程师');
    expect(other.profile.title).toBe('后端工程师');
    // 默认范文本身没被改
    expect(buildExampleContent(findExample('frontend')!).profile.title).toBe('前端工程师');
  });
});

describe('applyPageMeta', () => {
  it('写入标题、描述、robots 与 canonical', () => {
    applyPageMeta({ title: '前端工程师简历', description: '示例描述', path: '/examples/frontend' });

    expect(document.title).toBe('前端工程师简历 · OpenResume');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('示例描述');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/examples\/frontend$/
    );
  });

  it('标题里已含站点名时不重复拼接', () => {
    applyPageMeta({ title: 'OpenResume · 在线简历制作' });
    expect(document.title).toBe('OpenResume · 在线简历制作');
  });

  it('noindex 时 robots 改为 noindex, nofollow', () => {
    applyPageMeta({ title: '私密页', indexable: false });
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    );
  });

  it('重复调用只更新同一批标签，不会堆积', () => {
    applyPageMeta({ title: 'A', description: '第一版' });
    applyPageMeta({ title: 'B', description: '第二版' });

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('第二版');
  });
});

describe('结构化数据', () => {
  it('setJsonLd 同 id 只保留一份', () => {
    setJsonLd('faq', faqJsonLd([{ q: '问', a: '答' }]));
    setJsonLd('faq', faqJsonLd([{ q: '问2', a: '答2' }]));

    const scripts = document.head.querySelectorAll('script[data-seo="faq"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].textContent).toContain('问2');
  });

  it('removeJsonLd 清掉对应节点', () => {
    setJsonLd('breadcrumb', breadcrumbJsonLd([{ name: '首页', path: '/' }]));
    removeJsonLd('breadcrumb');
    expect(document.head.querySelector('script[data-seo="breadcrumb"]')).toBeNull();
  });

  it('FAQ 的问答与传入数组一一对应', () => {
    const faqs = [
      { q: '能导出 PDF 吗', a: '可以' },
      { q: '要登录吗', a: '不需要' }
    ];
    const data = faqJsonLd(faqs) as any;
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(2);
    expect(data.mainEntity[1].acceptedAnswer.text).toBe('不需要');
  });

  it('SoftwareApplication 只声明可验证事实：免费、可访问、无虚构评分', () => {
    const data = softwareApplicationJsonLd() as any;
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.offers.price).toBe('0');
    expect(data.isAccessibleForFree).toBe(true);
    expect(data.aggregateRating).toBeUndefined();
  });

  it('面包屑位置从 1 递增，item 为绝对地址', () => {
    const data = breadcrumbJsonLd([
      { name: '首页', path: '/' },
      { name: '简历示例', path: '/examples' }
    ]) as any;
    expect(data.itemListElement.map((item: any) => item.position)).toEqual([1, 2]);
    expect(data.itemListElement[1].item).toMatch(/^https?:\/\/.+\/examples$/);
  });
});
