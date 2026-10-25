import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ClassicTemplate from '../../../src/templates/ClassicTemplate.vue';
import GeekTemplate from '../../../src/templates/GeekTemplate.vue';
import ModernTemplate from '../../../src/templates/ModernTemplate.vue';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../../../src/utils/presets';
import type { ResumeContent, ThemeConfig } from '../../../src/types/resume';

function makeContent(): ResumeContent {
  return JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)) as ResumeContent;
}

const templates = [
  { name: 'ClassicTemplate', component: ClassicTemplate },
  { name: 'GeekTemplate', component: GeekTemplate },
  { name: 'ModernTemplate', component: ModernTemplate }
] as const;

function styleOf(wrapper: ReturnType<typeof mount>): string {
  return wrapper.element.getAttribute('style') ?? '';
}

describe.each(templates)('$name 主题变量', ({ component }) => {
  it('把主题参数注入为 CSS 变量', () => {
    const theme: ThemeConfig = {
      ...DEFAULT_THEME_CONFIG,
      fontSize: 16,
      lineHeight: 1.7,
      themeColor: '#123456',
      sectionSpacing: 22,
      paragraphSpacing: 9,
      pagePadding: 15
    };

    const style = styleOf(mount(component, { props: { content: makeContent(), theme } }));

    expect(style).toContain('--rs-font-size: 16px');
    expect(style).toContain('--rs-line-height: 1.7');
    expect(style).toContain('--rs-color: #123456');
    expect(style).toContain('--rs-section-gap: 22px');
    expect(style).toContain('--rs-para-gap: 9px');
    expect(style).toContain('--rs-page-pad: 15mm');
  });

  it('不再把基准字号写成内联 font-size（否则子元素固定字号会覆盖滑块）', () => {
    const style = styleOf(
      mount(component, {
        props: { content: makeContent(), theme: { ...DEFAULT_THEME_CONFIG, fontSize: 13 } }
      })
    );

    expect(style).not.toMatch(/(^|;)\s*font-size\s*:/);
  });

  it('正文不使用 Tailwind 固定字号类', () => {
    const html = mount(component, {
      props: { content: makeContent(), theme: DEFAULT_THEME_CONFIG }
    }).html();

    // text-xs / text-sm / text-2xs 等会让字号滑块失效
    expect(html).not.toMatch(/\btext-(2xs|xs|sm|base|lg|xl|2xl|\[1\dpx\])\b/);
  });

  it('简历内不残留 emoji 图标', () => {
    const html = mount(component, {
      props: { content: makeContent(), theme: DEFAULT_THEME_CONFIG }
    }).html();

    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe('ModernTemplate 模块顺序', () => {
  it('侧栏教育/技能跟随 modulesOrder 的相对顺序', () => {
    const content = makeContent();
    content.modulesOrder = ['skills', 'education', 'work', 'projects', 'custom'];

    const html = mount(ModernTemplate, {
      props: { content, theme: DEFAULT_THEME_CONFIG }
    }).html();

    const skillsAt = html.indexOf(content.modules.skills.title);
    const educationAt = html.indexOf(content.modules.education.title);

    expect(skillsAt).toBeGreaterThan(-1);
    expect(educationAt).toBeGreaterThan(-1);
    expect(skillsAt).toBeLessThan(educationAt);
  });
});

describe('薪资字段默认隐藏', () => {
  it.each(templates)('$name 默认不渲染薪资期望', ({ component }) => {
    const content = makeContent();
    content.profile.salaryExpectation = '30k-40k';

    const html = mount(component, {
      props: { content, theme: { ...DEFAULT_THEME_CONFIG, showSalary: false } }
    }).html();

    expect(html).not.toContain('30k-40k');
  });

  it.each(templates)('$name 开启 showSalary 后渲染薪资期望', ({ component }) => {
    const content = makeContent();
    content.profile.salaryExpectation = '30k-40k';

    const html = mount(component, {
      props: { content, theme: { ...DEFAULT_THEME_CONFIG, showSalary: true } }
    }).html();

    expect(html).toContain('30k-40k');
  });
});
