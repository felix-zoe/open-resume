import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ClassicTemplate from '../../../src/templates/ClassicTemplate.vue';
import GeekTemplate from '../../../src/templates/GeekTemplate.vue';
import ModernTemplate from '../../../src/templates/ModernTemplate.vue';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../../../src/utils/presets';
import type { ResumeContent } from '../../../src/types/resume';

function makeContent(overrides: {
  github?: string;
  website?: string;
  link?: string;
}): ResumeContent {
  const content = JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)) as ResumeContent;
  content.profile.github = overrides.github;
  content.profile.website = overrides.website;
  // 预设里已有演示链接，先清空，确保断言只受入参影响
  content.modules.projects.items.forEach((item) => {
    item.link = undefined;
  });
  content.modules.projects.items[0].link = overrides.link;
  return content;
}

const templates = [
  { name: 'ClassicTemplate', component: ClassicTemplate },
  { name: 'GeekTemplate', component: GeekTemplate },
  { name: 'ModernTemplate', component: ModernTemplate }
] as const;

describe.each(templates)('$name 外链安全', ({ component }) => {
  it('不渲染 javascript: 协议的 GitHub / 作品集链接', () => {
    const wrapper = mount(component, {
      props: {
        content: makeContent({
          github: 'javascript:alert(1)',
          website: 'javascript:alert(2)'
        }),
        theme: DEFAULT_THEME_CONFIG
      }
    });

    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '');
    expect(hrefs.some((href) => href.toLowerCase().startsWith('javascript:'))).toBe(false);
    // 非法链接整体不渲染锚点，只保留纯文本场景由 v-if 控制
    expect(wrapper.text()).not.toContain('GitHub');
  });

  it('正常 https 链接保留并带 noopener', () => {
    const wrapper = mount(component, {
      props: {
        content: makeContent({
          github: 'https://github.com/example',
          website: 'https://blog.example.com'
        }),
        theme: DEFAULT_THEME_CONFIG
      }
    });

    const links = wrapper.findAll('a');
    const github = links.find((a) => a.attributes('href') === 'https://github.com/example');
    expect(github).toBeTruthy();
    expect(github!.attributes('rel')).toBe('noopener noreferrer');
  });

  it('裸域名会被补全为 https 链接', () => {
    const wrapper = mount(component, {
      props: {
        content: makeContent({ github: 'github.com/example' }),
        theme: DEFAULT_THEME_CONFIG
      }
    });

    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'));
    expect(hrefs).toContain('https://github.com/example');
  });
});

describe('ClassicTemplate 项目链接', () => {
  it('拒绝 javascript: 的项目演示链接', () => {
    const wrapper = mount(ClassicTemplate, {
      props: {
        content: makeContent({ link: 'javascript:alert(3)' }),
        theme: DEFAULT_THEME_CONFIG
      }
    });

    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '');
    expect(hrefs.some((href) => href.toLowerCase().startsWith('javascript:'))).toBe(false);
    expect(wrapper.text()).not.toContain('演示链接');
  });

  it('保留合法的项目演示链接', () => {
    const wrapper = mount(ClassicTemplate, {
      props: {
        content: makeContent({ link: 'https://demo.example.com' }),
        theme: DEFAULT_THEME_CONFIG
      }
    });

    // URL 规范化会补上根路径斜杠
    const link = wrapper
      .findAll('a')
      .find((a) => a.attributes('href') === 'https://demo.example.com/');
    expect(link).toBeTruthy();
    expect(link!.attributes('rel')).toBe('noopener noreferrer');
  });
});
