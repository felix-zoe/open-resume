import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MonthPicker from '../../../src/components/editor/MonthPicker.vue';

describe('MonthPicker', () => {
  it('把 YYYY.MM 正确拆到年/月下拉框', () => {
    const wrapper = mount(MonthPicker, {
      props: { modelValue: '2022.07', label: '开始时间' },
    });

    const selects = wrapper.findAll('select');
    expect((selects[0].element as HTMLSelectElement).value).toBe('2022');
    expect((selects[1].element as HTMLSelectElement).value).toBe('7');
  });

  it('选择年份后输出统一的 YYYY.MM 格式', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '2022.07' } });

    const yearSelect = wrapper.findAll('select')[0];
    await yearSelect.setValue('2023');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2023.07']);
  });

  it('月份补零，避免出现 2023.7 这种不一致格式', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '2023.01' } });

    await wrapper.findAll('select')[1].setValue('7');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['2023.07']);
  });

  it('允许“至今”时点击切换为至今', async () => {
    const wrapper = mount(MonthPicker, {
      props: { modelValue: '2023.01', allowPresent: true },
    });

    const presentBtn = wrapper.findAll('button').find((b) => b.text() === '至今')!;
    await presentBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['至今']);
  });

  it('值为“至今”时隐藏年月下拉框', () => {
    const wrapper = mount(MonthPicker, {
      props: { modelValue: '至今', allowPresent: true },
    });

    expect(wrapper.findAll('select')).toHaveLength(0);
    expect(wrapper.text()).toContain('至今');
  });

  it('不允许“至今”时不显示切换按钮', () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '2022.09' } });

    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('旧格式值给出提示而不是静默丢失', () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '2022-07' } });

    expect(wrapper.text()).toContain('格式不标准');
    expect(wrapper.text()).toContain('2022-07');
  });

  it('空值时不误报旧格式', () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '' } });

    expect(wrapper.text()).not.toContain('格式不标准');
  });

  it('清空选择时输出空字符串', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '2022.07' } });

    await wrapper.findAll('select')[0].setValue('');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);
  });

  it('只选月份时用当前年份兜底，不会产出非法值', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: '' } });

    await wrapper.findAll('select')[1].setValue('3');

    const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string;
    expect(emitted).toMatch(/^\d{4}\.03$/);
  });
});
