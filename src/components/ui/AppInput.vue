<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

type Size = 'sm' | 'md';

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    size?: Size;
    invalid?: boolean;
    /** 左侧图标插槽名对应的布局留白 */
    hasLeading?: boolean;
    /** 右侧图标/按钮的留白 */
    hasTrailing?: boolean;
  }>(),
  { modelValue: '', size: 'md', invalid: false, hasLeading: false, hasTrailing: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const attrs = useAttrs();

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 text-xs',
  md: 'h-9 text-xs'
};

const classes = computed(() =>
  cx(
    'w-full bg-white border rounded-lg text-slate-900 placeholder:text-slate-400',
    'transition-colors outline-none',
    'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
    'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
    props.invalid
      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
      : 'border-slate-200 hover:border-slate-300',
    SIZE_CLASSES[props.size],
    props.hasLeading ? 'pl-8 pr-2.5' : 'px-2.5',
    props.hasTrailing && 'pr-9',
    attrs.class as string | undefined
  )
);

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
};
</script>

<template>
  <input
    v-bind="{ ...attrs, class: undefined }"
    :value="modelValue"
    :class="classes"
    :aria-invalid="invalid || undefined"
    @input="onInput"
  />
</template>
