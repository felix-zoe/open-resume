import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ModuleManagerDrawer from '../../../src/components/editor/ModuleManagerDrawer.vue';
import { useResumeStore } from '../../../src/stores/resume';

function mountDrawer() {
  return mount(ModuleManagerDrawer, {
    props: { open: true },
    global: { stubs: { Teleport: true } }
  });
}

describe('ModuleManagerDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('按当前 modulesOrder 渲染模块列表', () => {
    const store = useResumeStore();
    store.content.modulesOrder = ['projects', 'work', 'skills', 'education', 'custom'];

    const wrapper = mountDrawer();
    const titles = wrapper.findAll('li').map((li) => li.text());

    expect(titles[0]).toContain('项目经历');
    expect(titles[1]).toContain('工作经历');
  });

  it('下移按钮改变草稿顺序，但不立刻写回 store', async () => {
    const store = useResumeStore();
    store.content.modulesOrder = ['work', 'projects', 'skills', 'education', 'custom'];
    const original = [...store.content.modulesOrder];

    const wrapper = mountDrawer();
    await wrapper.findAll('button[aria-label="「工作经历」下移"]')[0].trigger('click');

    const items = wrapper.findAll('li');
    expect(items[0].text()).toContain('项目经历');
    // 未点「应用顺序」前 store 不变
    expect(store.content.modulesOrder).toEqual(original);
  });

  it('点击「应用顺序」才写回 store', async () => {
    const store = useResumeStore();
    store.content.modulesOrder = ['work', 'projects', 'skills', 'education', 'custom'];

    const wrapper = mountDrawer();
    await wrapper.findAll('button[aria-label="「工作经历」下移"]')[0].trigger('click');

    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('应用顺序'));
    expect(applyBtn).toBeTruthy();
    await applyBtn!.trigger('click');

    expect(store.content.modulesOrder[0]).toBe('projects');
    expect(store.content.modulesOrder[1]).toBe('work');
  });

  it('顺序未变时「应用」按钮禁用', () => {
    useResumeStore();
    const wrapper = mountDrawer();
    const applyBtn = wrapper.findAll('button').find((b) => b.text().includes('已是最新顺序'));
    expect(applyBtn?.attributes('disabled')).toBeDefined();
  });

  it('显隐按钮切换模块可见性', async () => {
    const store = useResumeStore();
    const before = store.content.modules.work.visible;

    const wrapper = mountDrawer();
    await wrapper.find('button[aria-label^="隐藏「工作经历」"]').trigger('click');

    expect(store.content.modules.work.visible).toBe(!before);
  });

  it('第一个模块的上移按钮禁用，最后一个的下移按钮禁用', () => {
    const store = useResumeStore();
    store.content.modulesOrder = ['work', 'projects', 'skills', 'education', 'custom'];

    const wrapper = mountDrawer();
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label'));

    const upButtons = wrapper.findAll('button[aria-label$="上移"]');
    const downButtons = wrapper.findAll('button[aria-label$="下移"]');

    expect(upButtons[0].attributes('disabled')).toBeDefined();
    expect(downButtons[downButtons.length - 1].attributes('disabled')).toBeDefined();
    expect(labels.length).toBeGreaterThan(0);
  });

  it('模块标题可内联编辑并写回 store', async () => {
    const store = useResumeStore();
    const wrapper = mountDrawer();

    await wrapper.find('button[aria-label="编辑「工作经历」的标题"]').trigger('click');
    const input = wrapper.find('input[aria-label="工作经历 的模块标题"]');
    expect(input.exists()).toBe(true);

    await input.setValue('实习与工作');
    await wrapper.find('button[aria-label="确认标题"]').trigger('click');

    expect(store.content.modules.work.title).toBe('实习与工作');
  });

  it('取消编辑不修改标题', async () => {
    const store = useResumeStore();
    const before = store.content.modules.work.title;
    const wrapper = mountDrawer();

    await wrapper.find('button[aria-label="编辑「工作经历」的标题"]').trigger('click');
    await wrapper.find('input[aria-label="工作经历 的模块标题"]').setValue('临时改名');
    await wrapper.find('button[aria-label="取消编辑"]').trigger('click');

    expect(store.content.modules.work.title).toBe(before);
  });
});
