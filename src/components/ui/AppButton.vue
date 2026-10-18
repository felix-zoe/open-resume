<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
    type?: 'button' | 'submit' | 'reset';
    /** 图标按钮：无文字时必填，供屏幕阅读器使用 */
    ariaLabel?: string;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    block: false,
    type: 'button',
    ariaLabel: undefined
  }
);

const attrs = useAttrs();

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 disabled:hover:bg-primary-600',
  secondary:
    'bg-white text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger: 'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-700',
  subtle: 'bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200'
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-xs gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl'
};

const classes = computed(() =>
  cx(
    'inline-flex items-center justify-center font-semibold select-none whitespace-nowrap',
    'transition-colors duration-150',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
    VARIANT_CLASSES[props.variant],
    SIZE_CLASSES[props.size],
    props.block && 'w-full',
    attrs.class as string | undefined
  )
);

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    v-bind="{ ...attrs, class: undefined }"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    :aria-label="ariaLabel"
    :class="classes"
  >
    <!-- 加载态保留文字宽度：图标替换为 spinner，布局不跳动 -->
    <Loader2 v-if="loading" class="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
