<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** 可点击卡片：hover 提升 + 键盘可达 */
    interactive?: boolean;
    padding?: 'none' | 'sm' | 'md';
  }>(),
  { interactive: false, padding: 'md' }
);

const attrs = useAttrs();

const PADDING_CLASSES = {
  none: '',
  sm: 'p-3.5',
  md: 'p-5'
} as const;

const classes = computed(() =>
  cx(
    'bg-white border border-slate-200 rounded-xl shadow-2xs',
    PADDING_CLASSES[props.padding],
    props.interactive &&
      'cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
    attrs.class as string | undefined
  )
);
</script>

<template>
  <div v-bind="{ ...attrs, class: undefined }" :class="classes">
    <slot />
  </div>
</template>
