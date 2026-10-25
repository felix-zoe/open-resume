import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SectionProfile from '../../../src/modules/editor/SectionProfile.vue';
import { useResumeStore } from '../../../src/stores/resume';

function mountProfile() {
  return mount(SectionProfile, { global: { stubs: { Teleport: true } } });
}

describe('SectionProfile 字段校验', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('输入过程中不报错，失焦后才校验手机号', async () => {
    const store = useResumeStore();
    store.content.profile.phone = '123';

    const wrapper = mountProfile();
    const input = wrapper.find('#profile-phone');

    // 未失焦：不显示错误
    expect(wrapper.text()).not.toContain('11 位手机号');

    await input.trigger('blur');
    expect(wrapper.text()).toContain('11 位手机号');
  });

  it('合法手机号失焦后无错误', async () => {
    const store = useResumeStore();
    store.content.profile.phone = '13800138000';

    const wrapper = mountProfile();
    await wrapper.find('#profile-phone').trigger('blur');

    expect(wrapper.text()).not.toContain('11 位手机号');
  });

  it('非法邮箱给出错误文案并标记 aria-invalid', async () => {
    const store = useResumeStore();
    store.content.profile.email = 'not-an-email';

    const wrapper = mountProfile();
    const input = wrapper.find('#profile-email');
    await input.trigger('blur');

    expect(wrapper.text()).toContain('请输入有效邮箱');
    expect(input.attributes('aria-invalid')).toBe('true');
  });

  it('空邮箱不报格式错误（必填提示留给导出体检）', async () => {
    const store = useResumeStore();
    store.content.profile.email = '';

    const wrapper = mountProfile();
    await wrapper.find('#profile-email').trigger('blur');

    expect(wrapper.text()).not.toContain('请输入有效邮箱');
  });

  it('javascript: 外链在录入阶段就被拦下', async () => {
    const store = useResumeStore();
    store.content.profile.github = 'javascript:alert(1)';

    const wrapper = mountProfile();
    await wrapper.find('#profile-github').trigger('blur');

    expect(wrapper.text()).toContain('不支持该协议');
  });

  it('裸域名视为合法链接', async () => {
    const store = useResumeStore();
    store.content.profile.website = 'blog.example.com';

    const wrapper = mountProfile();
    await wrapper.find('#profile-website').trigger('blur');

    expect(wrapper.text()).not.toContain('请输入有效链接');
  });

  it('错误文案通过 role=alert 暴露给屏幕阅读器', async () => {
    const store = useResumeStore();
    store.content.profile.phone = '123';

    const wrapper = mountProfile();
    await wrapper.find('#profile-phone').trigger('blur');

    const alert = wrapper.find('#profile-phone-error');
    expect(alert.attributes('role')).toBe('alert');
    expect(wrapper.find('#profile-phone').attributes('aria-describedby')).toBe('profile-phone-error');
  });
});
