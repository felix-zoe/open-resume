import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ToastHost from '../../../src/components/ui/ToastHost.vue';
import { useToast } from '../../../src/composables/useToast';
import { askConfirm, useConfirmState } from '../../../src/composables/useConfirm';

describe('useToast + ToastHost', () => {
  beforeEach(() => {
    useToast().clear();
    vi.useRealTimers();
  });

  it('success 在 3 秒后自动消失', async () => {
    vi.useFakeTimers();
    const toast = useToast();
    const wrapper = mount(ToastHost, { attachTo: document.body });

    toast.success('已保存');
    await nextTick();
    expect(wrapper.text()).toContain('已保存');

    vi.advanceTimersByTime(3100);
    await nextTick();
    expect(wrapper.text()).not.toContain('已保存');

    wrapper.unmount();
  });

  it('error 保留 5 秒且可手动关闭', async () => {
    vi.useFakeTimers();
    const toast = useToast();
    const wrapper = mount(ToastHost, { attachTo: document.body });

    toast.error('保存失败');
    await nextTick();
    expect(wrapper.text()).toContain('保存失败');

    await wrapper.find('button[aria-label="关闭提示"]').trigger('click');
    await nextTick();
    expect(wrapper.text()).not.toContain('保存失败');

    wrapper.unmount();
  });

  it('copyFallback 常驻并展示可选中文本', async () => {
    const toast = useToast();
    const wrapper = mount(ToastHost, { attachTo: document.body });

    toast.copyFallback('无法写入剪贴板', 'https://example.com/share/res_1');
    await nextTick();

    expect(wrapper.text()).toContain('无法写入剪贴板');
    expect(wrapper.text()).toContain('https://example.com/share/res_1');
    expect(wrapper.find('.select-all').exists()).toBe(true);

    wrapper.unmount();
  });

  it('容器带 aria-live=polite', () => {
    const wrapper = mount(ToastHost, { attachTo: document.body });
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true);
    wrapper.unmount();
  });
});

describe('askConfirm', () => {
  beforeEach(() => {
    // 清理可能残留的确认框
    useConfirmState().value;
  });

  it('返回 Promise 并由 resolveConfirm 结算', async () => {
    const { resolveConfirm } = await import('../../../src/composables/useConfirm');
    const promise = askConfirm({ title: '删除？', tone: 'danger' });

    expect(useConfirmState().value?.title).toBe('删除？');
    expect(useConfirmState().value?.tone).toBe('danger');

    resolveConfirm(true);
    await expect(promise).resolves.toBe(true);
    expect(useConfirmState().value).toBeNull();
  });

  it('取消返回 false', async () => {
    const { resolveConfirm } = await import('../../../src/composables/useConfirm');
    const promise = askConfirm({ title: '删除？' });
    resolveConfirm(false);
    await expect(promise).resolves.toBe(false);
  });

  it('重复打开时上一个确认框自动取消', async () => {
    const { resolveConfirm } = await import('../../../src/composables/useConfirm');
    const first = askConfirm({ title: '第一个' });
    const second = askConfirm({ title: '第二个' });

    await expect(first).resolves.toBe(false);
    expect(useConfirmState().value?.title).toBe('第二个');

    resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });
});
