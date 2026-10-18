<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const props = withDefaults(
  defineProps<{
    tone?: Tone;
    size?: 'sm' | 'md';
    /** 前缀圆点，用于状态标识 */
    dot?: boolean;
  }>(),
  { tone: 'neutral', size: 'sm', dot: false }
);

const attrs = useAttrs();

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  primary: 'bg-primary-50 text-primary-700 border-primary-100',
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100'
};

const DOT_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  primary: 'bg-primary-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500'
};

const classes = computed(() =>
  cx(
    'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
    props.size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
    TONE_CLASSES[props.tone],
    attrs.class as string | undefined
  )
);
</script>

<template>
  <span v-bind="{ ...attrs, class: undefined }" :class="classes">
    <span v-if="dot" :class="cx('w-1.5 h-1.5 rounded-full', DOT_CLASSES[tone])" aria-hidden="true" />
    <slot />
  </span>
</template>
