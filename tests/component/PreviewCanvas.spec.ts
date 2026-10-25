import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import PreviewCanvas from '../../src/modules/editor/PreviewCanvas.vue';
import { useResumeStore } from '../../src/stores/resume';
import ModernTemplate from '../../src/templates/ModernTemplate.vue';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../../src/utils/presets';
import { A4_HEIGHT_PX, MM_TO_PX, getUsableHeight } from '../../src/utils/a4';

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

/** 从 `top: 1122.52px;` 里取出数值 */
function topOf(style: string | undefined): number {
  const match = /top:\s*([\d.]+)px/.exec(style ?? '');
  return match ? Number(match[1]) : Number.NaN;
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

  it('内容超过一页时显示 2 页，断线落在纸张底部', async () => {
    const wrapper = await mountAndMeasure(1300);

    const lines = wrapper.findAll('.page-indicator-line');
    expect(lines).toHaveLength(1);

    // 断线标的是“本页内容到此为止”，因此落在下边距的上沿：
    // 纸张高度 - 下页边距。它不该压到纸张物理底部。
    const bottomPadding = DEFAULT_THEME_CONFIG.pagePadding * MM_TO_PX;
    expect(topOf(lines[0].attributes('style'))).toBeCloseTo(A4_HEIGHT_PX - bottomPadding, 1);
    expect(wrapper.text()).toContain('当前约 2 页');
  });

  it('测量的是内容节点而不是带 min-height 的纸张', async () => {
    const wrapper = await mountAndMeasure(1300);

    const paper = wrapper.find('.a4-print-target').element as HTMLElement;
    // 纸张 scrollHeight 保持 jsdom 默认 0，若组件错误地测量纸张会得到 1 页
    Object.defineProperty(paper, 'scrollHeight', { configurable: true, value: 1123 });
    expect(wrapper.findAll('.page-indicator-line')).toHaveLength(1);
  });

  it('页边距由纸张承担，分页后每页都有留白', async () => {
    const wrapper = await mountAndMeasure(500);
    const paper = wrapper.find('.a4-print-target').element as HTMLElement;

    // Vue 会把四个等值的 padding-* 合并成 `padding` 简写，因此读计算后的值
    const expected = DEFAULT_THEME_CONFIG.pagePadding * MM_TO_PX;
    expect(parseFloat(paper.style.paddingTop || paper.style.padding)).toBeCloseTo(expected, 1);
    expect(parseFloat(paper.style.paddingBottom || paper.style.padding)).toBeCloseTo(expected, 1);
  });

  it('页数按扣除页边距后的可用高度计算，与打印保持一致', async () => {
    const usable = getUsableHeight(DEFAULT_THEME_CONFIG.pagePadding);
    // 刚好超过可用高度一点，应判定为 2 页
    const wrapper = await mountAndMeasure(usable + 1);

    expect(wrapper.text()).toContain('当前约 2 页');
  });

  it('Modern 模板由栏位自己承担页边距，纸张不重复加 padding', async () => {
    const wrapper = mount(PreviewCanvas, { global: { plugins: [createPinia()] } });
    const store = useResumeStore();
    store.templateId = 'modern';
    await nextTick();
    await nextTick();

    const style = wrapper.find('.a4-print-target').attributes('style') ?? '';
    expect(style).not.toContain('padding-top');
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
