import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ClassicTemplate from '../../../src/templates/ClassicTemplate.vue';
import GeekTemplate from '../../../src/templates/GeekTemplate.vue';
import ModernTemplate from '../../../src/templates/ModernTemplate.vue';
import AtsTemplate from '../../../src/templates/AtsTemplate.vue';
import {
  DEFAULT_EN_RESUME_CONTENT,
  DEFAULT_RESUME_CONTENT,
  DEFAULT_THEME_CONFIG
} from '../../../src/utils/presets';
import type { ResumeContent } from '../../../src/types/resume';

function clone(content: ResumeContent): ResumeContent {
  return JSON.parse(JSON.stringify(content)) as ResumeContent;
}

const templates = [
  { name: 'ClassicTemplate', component: ClassicTemplate },
  { name: 'GeekTemplate', component: GeekTemplate },
  { name: 'ModernTemplate', component: ModernTemplate },
  { name: 'AtsTemplate', component: AtsTemplate }
] as const;

describe.each(templates)('$name 简历语言渲染', ({ component }) => {
  it('英文简历输出英文模块标题，不出现中文默认标题', () => {
    const wrapper = mount(component, {
      props: { content: clone(DEFAULT_EN_RESUME_CONTENT), theme: DEFAULT_THEME_CONFIG }
    });
    const text = wrapper.text();

    expect(text).toContain('Work Experience');
    expect(text).not.toContain('工作经历');
    expect(text).not.toContain('教育背景');
  });

  it('英文简历的日期区间用 MM/YYYY 与 Present', () => {
    const wrapper = mount(component, {
      props: { content: clone(DEFAULT_EN_RESUME_CONTENT), theme: DEFAULT_THEME_CONFIG }
    });
    const text = wrapper.text();

    expect(text).toContain('07/2022');
    expect(text).toContain('Present');
    expect(text).not.toContain('至今');
  });

  it('中文简历保持中文标题与 YYYY.MM 日期', () => {
    const wrapper = mount(component, {
      props: { content: clone(DEFAULT_RESUME_CONTENT), theme: DEFAULT_THEME_CONFIG }
    });
    const text = wrapper.text();

    expect(text).toContain('工作经历');
    expect(text).toContain('2022.07');
    expect(text).toContain('至今');
  });

  it('切换语言不改写用户自定义的模块标题', () => {
    const content = clone(DEFAULT_RESUME_CONTENT);
    content.locale = 'en';
    content.modules.work.title = '核心项目与产出';
    // 其余标题仍是默认值，应当跟随语言切换
    const wrapper = mount(component, {
      props: { content, theme: DEFAULT_THEME_CONFIG }
    });
    const text = wrapper.text();

    expect(text).toContain('核心项目与产出');
    expect(text).toContain('Projects');
  });
});

describe('技能形态（TPL-04）', () => {
  it('Classic 默认整句：逐行列出，不渲染胶囊', () => {
    const content = clone(DEFAULT_RESUME_CONTENT);
    const wrapper = mount(ClassicTemplate, {
      props: { content, theme: DEFAULT_THEME_CONFIG }
    });

    expect(wrapper.findAll('li.rs-item').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.rs-skill-tag')).toHaveLength(0);
  });

  it('Classic 切成标签：渲染胶囊，不再有技能列表项', () => {
    const content = clone(DEFAULT_RESUME_CONTENT);
    content.modules.skills.type = 'tag';
    const wrapper = mount(ClassicTemplate, {
      props: { content, theme: DEFAULT_THEME_CONFIG }
    });

    const tags = wrapper.findAll('.rs-skill-tag');
    expect(tags).toHaveLength(content.modules.skills.items.length);
    expect(tags[0].text()).toBe(content.modules.skills.items[0]);
  });

  it('Geek 默认标签，切成整句后改为逐行', () => {
    const content = clone(DEFAULT_RESUME_CONTENT);

    const asTag = mount(GeekTemplate, { props: { content, theme: DEFAULT_THEME_CONFIG } });
    expect(asTag.findAll('.rs-skill-tag').length).toBeGreaterThan(0);

    content.modules.skills.type = 'sentence';
    const asSentence = mount(GeekTemplate, { props: { content, theme: DEFAULT_THEME_CONFIG } });
    expect(asSentence.findAll('.rs-skill-tag')).toHaveLength(0);
    expect(asSentence.text()).toContain(content.modules.skills.items[0]);
  });

  it('ATS 模板始终输出一行纯文本，不受技能形态影响', () => {
    const content = clone(DEFAULT_RESUME_CONTENT);
    content.modules.skills.type = 'tag';
    const wrapper = mount(AtsTemplate, { props: { content, theme: DEFAULT_THEME_CONFIG } });

    expect(wrapper.findAll('.rs-skill-tag')).toHaveLength(0);
    // 中文用顿号连接
    expect(wrapper.text()).toContain(content.modules.skills.items.join('、'));
  });
});
