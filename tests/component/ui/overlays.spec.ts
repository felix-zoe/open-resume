import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AppModal from '../../../src/components/ui/AppModal.vue';
import AppDrawer from '../../../src/components/ui/AppDrawer.vue';
import AppMenu from '../../../src/components/ui/AppMenu.vue';

const mountOptions = { attachTo: document.body };

/** 上一个用例失败时可能残留滚动锁，逐个用例复位 */
beforeEach(() => {
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

/** 遮罩层：无 role 的 aria-hidden 绝对定位层 */
const overlay = () =>
  document.body.querySelector<HTMLElement>('[role="dialog"]')
    ?.parentElement
    ?.querySelector<HTMLElement>('[aria-hidden="true"]') ?? null;

describe('AppModal', () => {
  it('打开时渲染 dialog 并锁定 body 滚动', async () => {
    const wrapper = mount(AppModal, {
      props: { open: true, title: '排版设置' },
      slots: { default: '<input placeholder="第一个字段" />' },
      ...mountOptions
    });
    await nextTick();

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    // 打开后焦点落在第一个可聚焦元素
    expect(document.activeElement?.tagName).toBe('INPUT');

    wrapper.unmount();
  });

  it('Esc 关闭并 emit', async () => {
    const wrapper = mount(AppModal, { props: { open: true, title: 'x' }, ...mountOptions });
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('closeOnEsc=false 时 Esc 不关闭', async () => {
    const wrapper = mount(AppModal, {
      props: { open: true, closeOnEsc: false },
      ...mountOptions
    });
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(wrapper.emitted('close')).toBeUndefined();
    wrapper.unmount();
  });

  it('遮罩点击行为可配置', async () => {
    const closable = mount(AppModal, { props: { open: true }, ...mountOptions });
    await nextTick();
    overlay()?.click();
    await nextTick();
    expect(closable.emitted('close')).toHaveLength(1);
    closable.unmount();

    const locked = mount(AppModal, { props: { open: true, closeOnOverlay: false }, ...mountOptions });
    await nextTick();
    overlay()?.click();
    await nextTick();
    expect(locked.emitted('close')).toBeUndefined();
    locked.unmount();
  });

  it('关闭后恢复 body 滚动与焦点', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const wrapper = mount(AppModal, { props: { open: true }, ...mountOptions });
    await nextTick();
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.setProps({ open: false });
    await nextTick();

    expect(document.body.style.overflow).not.toBe('hidden');
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    trigger.remove();
  });
});

describe('AppDrawer', () => {
  it('渲染 dialog 并在 Esc 时关闭', async () => {
    const wrapper = mount(AppDrawer, { props: { open: true, title: '样式' }, ...mountOptions });
    await nextTick();

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });
});

describe('AppMenu', () => {
  it('点击外部关闭', async () => {
    const wrapper = mount(AppMenu, {
      props: { open: true },
      slots: { default: '<button role="menuitem">重命名</button>' },
      ...mountOptions
    });
    await nextTick();

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
    wrapper.unmount();
  });

  it('Esc 关闭', async () => {
    const wrapper = mount(AppMenu, {
      props: { open: true },
      slots: { default: '<button role="menuitem">删除</button>' },
      ...mountOptions
    });
    await nextTick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false]);
    wrapper.unmount();
  });
});
