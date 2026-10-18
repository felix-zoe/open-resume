<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

/**
 * 品牌标记（字母 R 方块）。
 *
 * 单独抽成原语的原因：`bg-primary-600` 只允许出现在 `src/components/ui/**`
 * （见 scripts/check-static.mjs），而 Logo 需要品牌底色，因此把这一处
 * 品牌实色收敛到这里，页面层只负责尺寸与圆角。
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** 标记尺寸，对应边长 24 / 28 / 32 / 36 px */
    size?: 'xs' | 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' }
);

const attrs = useAttrs();

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-9 h-9 text-base'
} as const;

const classes = computed(() =>
  cx(
    'shrink-0 rounded-lg bg-primary-600 text-white flex items-center justify-center font-black select-none',
    SIZE_CLASSES[props.size],
    attrs.class as string | undefined
  )
);
</script>

<template>
  <span v-bind="{ ...attrs, class: undefined }" :class="classes" aria-hidden="true">R</span>
</template>
