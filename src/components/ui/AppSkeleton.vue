<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** 渲染成 n 行文本骨架 */
    lines?: number;
    /** 单块高度类，如 h-24 */
    heightClass?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'full';
  }>(),
  { lines: 0, heightClass: 'h-4', rounded: 'md' }
);

const attrs = useAttrs();

const ROUNDED = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full'
} as const;

const blockClass = computed(() =>
  cx('bg-slate-100 animate-pulse', ROUNDED[props.rounded], props.heightClass)
);
</script>

<template>
  <div
    v-bind="{ ...attrs, class: undefined }"
    :class="cx('space-y-2', attrs.class as string | undefined)"
    aria-hidden="true"
  >
    <template v-if="lines > 0">
      <div
        v-for="i in lines"
        :key="i"
        :class="[blockClass, i === lines && 'w-2/3']"
      />
    </template>
    <div v-else :class="blockClass" />
  </div>
</template>
