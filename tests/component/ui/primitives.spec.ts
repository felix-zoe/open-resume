import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import AppButton from '../../../src/components/ui/AppButton.vue';
import AppInput from '../../../src/components/ui/AppInput.vue';
import FormField from '../../../src/components/ui/FormField.vue';
import AppCheckbox from '../../../src/components/ui/AppCheckbox.vue';
import AppSwitch from '../../../src/components/ui/AppSwitch.vue';
import AppBadge from '../../../src/components/ui/AppBadge.vue';
import AppTabs from '../../../src/components/ui/AppTabs.vue';
import AppEmpty from '../../../src/components/ui/AppEmpty.vue';

describe('AppButton', () => {
  it('点击时透传 click 事件', async () => {
    const wrapper = mount(AppButton, { slots: { default: '保存' } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('loading 时禁用并设置 aria-busy', () => {
    const wrapper = mount(AppButton, { props: { loading: true }, slots: { default: '保存' } });
    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.attributes('aria-busy')).toBe('true');
  });

  it('disabled 时不触发点击', async () => {
    const wrapper = mount(AppButton, { props: { disabled: true } });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('variant / size 映射到不同 class', () => {
    const primary = mount(AppButton, { props: { variant: 'primary' } });
    const danger = mount(AppButton, { props: { variant: 'danger', size: 'lg' } });
    expect(primary.classes()).toContain('bg-primary-600');
    expect(danger.classes()).toContain('bg-danger-600');
    expect(danger.classes()).toContain('h-11');
  });

  it('保留外部传入的 class 与属性', () => {
    const wrapper = mount(AppButton, {
      attrs: { class: 'custom-class', 'data-test': 'btn' }
    });
    expect(wrapper.classes()).toContain('custom-class');
    expect(wrapper.attributes('data-test')).toBe('btn');
  });
});

describe('AppInput + FormField', () => {
  it('输入时 emit update:modelValue', async () => {
    const wrapper = mount(AppInput);
    await wrapper.setValue('张三');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['张三']);
  });

  it('FormField 用 label for 关联控件 id', () => {
    const wrapper = mount(FormField, {
      props: { label: '姓名', required: true },
      slots: {
        default: ({ id, describedBy }: { id: string; describedBy?: string }) =>
          h(AppInput, { id, 'aria-describedby': describedBy })
      }
    });

    const label = wrapper.find('label');
    const input = wrapper.find('input');
    expect(label.attributes('for')).toBeTruthy();
    expect(input.attributes('id')).toBe(label.attributes('for'));
    expect(wrapper.text()).toContain('必填');
  });

  it('FormField 错误时 aria-invalid 且 error 文案可被朗读', () => {
    const wrapper = mount(FormField, {
      props: { label: '邮箱', error: '邮箱格式不正确' },
      slots: {
        default: ({ id, describedBy, invalid }: { id: string; describedBy?: string; invalid: boolean }) =>
          h(AppInput, { id, 'aria-describedby': describedBy, invalid })
      }
    });

    const input = wrapper.find('input');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBeTruthy();

    const error = wrapper.find('[role="alert"]');
    expect(error.text()).toBe('邮箱格式不正确');
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'));
  });
});

describe('AppCheckbox / AppSwitch', () => {
  it('checkbox 点击后 emit 新值', async () => {
    const wrapper = mount(AppCheckbox, { props: { modelValue: false, label: '记住我' } });
    await wrapper.find('input').setValue(true);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('switch 具备 role 与 aria-checked', async () => {
    const wrapper = mount(AppSwitch, { props: { modelValue: false, label: '公开分享' } });
    const button = wrapper.find('[role="switch"]');
    expect(button.attributes('aria-checked')).toBe('false');

    await button.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('switch 禁用时不 emit', async () => {
    const wrapper = mount(AppSwitch, { props: { modelValue: false, disabled: true } });
    await wrapper.find('[role="switch"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('AppTabs', () => {
  const tabs = [
    { key: 'content', label: '内容' },
    { key: 'preview', label: '预览' }
  ];

  it('点击切换并 emit', async () => {
    const wrapper = mount(AppTabs, { props: { modelValue: 'content', tabs } });
    await wrapper.findAll('[role="tab"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['preview']);
  });

  it('方向键在 tab 间移动', async () => {
    const wrapper = mount(AppTabs, { props: { modelValue: 'content', tabs } });
    await wrapper.findAll('[role="tab"]')[0].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['preview']);
  });

  it('aria-selected 与 tabindex 跟随当前值', () => {
    const wrapper = mount(AppTabs, { props: { modelValue: 'preview', tabs } });
    const [first, second] = wrapper.findAll('[role="tab"]');
    expect(first.attributes('aria-selected')).toBe('false');
    expect(first.attributes('tabindex')).toBe('-1');
    expect(second.attributes('aria-selected')).toBe('true');
    expect(second.attributes('tabindex')).toBe('0');
  });
});

describe('AppBadge / AppEmpty', () => {
  it('badge tone 映射到语义色', () => {
    const wrapper = mount(AppBadge, { props: { tone: 'success' }, slots: { default: '已公开' } });
    expect(wrapper.classes()).toContain('bg-success-50');
    expect(wrapper.text()).toBe('已公开');
  });

  it('empty 渲染标题、描述与操作插槽', async () => {
    const wrapper = mount(AppEmpty, {
      props: { title: '还没有简历', description: '从模板开始' },
      slots: { action: h(AppButton, {}, () => '新建') }
    });
    await nextTick();
    expect(wrapper.text()).toContain('还没有简历');
    expect(wrapper.text()).toContain('从模板开始');
    expect(wrapper.find('button').text()).toBe('新建');
  });
});
