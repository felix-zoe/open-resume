import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import PreviewCanvas from '../../src/modules/editor/PreviewCanvas.vue';
import { useResumeStore } from '../../src/stores/resume';
import ModernTemplate from '../../src/templates/ModernTemplate.vue';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../../src/utils/presets';

/** jsdom 不做布局，scrollHeight 恒为 0；这里按用例注入内容高度 */
function stubContentHeight(wrapper: ReturnType<typeof mount>, height: number) {
  const doc = wrapper.find('.a4-print-target .resume-doc').element as HTMLElement;
  Object.defineProperty(doc, 'scrollHeight', { configurable: true, value: height });
}

async function mountAndMeasure(height: number) {
  const wrapper = mount(PreviewCanvas, { global: { plugins: [createPinia()] } });
  await nextTick();

  stubContentHeight(wrapper, height);
  // 触发 watch → nextTick(updateHeight)
  const store = useResumeStore();
  store.themeConfig.fontSize = store.themeConfig.fontSize + 0.5;
  await nextTick();
  await nextTick();

  return wrapper;
}

describe('PreviewCanvas 分页测量', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('内容低于一页时显示 1 页且无断线', async () => {
    const wrapper = await mountAndMeasure(500);

    expect(wrapper.find('.page-indicator-line').exists()).toBe(false);
    expect(wrapper.text()).toContain('当前约 1 页');
  });

  it('内容 1300px 时显示 2 页，断线在 A4 底部', async () => {
    const wrapper = await mountAndMeasure(1300);

    const lines = wrapper.findAll('.page-indicator-line');
    expect(lines).toHaveLength(1);
    expect(lines[0].attributes('style')).toContain('1122.52px');
    expect(wrapper.text()).toContain('当前约 2 页');
  });

  it('测量的是内容节点而不是带 min-height 的纸张', async () => {
    const wrapper = await mountAndMeasure(1300);

    const paper = wrapper.find('.a4-print-target').element as HTMLElement;
    // 纸张 scrollHeight 保持 jsdom 默认 0，若组件错误地测量纸张会得到 1 页
    Object.defineProperty(paper, 'scrollHeight', { configurable: true, value: 1123 });
    expect(wrapper.findAll('.page-indicator-line')).toHaveLength(1);
  });
});

describe('ModernTemplate 不再自带 min-height', () => {
  it('根节点带 resume-doc 且没有 297mm 高度约束', () => {
    const wrapper = mount(ModernTemplate, {
      props: {
        content: DEFAULT_RESUME_CONTENT,
        theme: DEFAULT_THEME_CONFIG
      }
    });

    const root = wrapper.find('.modern-template');
    expect(root.classes()).toContain('resume-doc');
    expect(root.attributes('style') ?? '').not.toContain('min-height');
    expect(root.classes()).not.toContain('min-h-[297mm]');
  });
});
