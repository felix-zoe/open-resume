<script setup lang="ts">
import { useAttrs } from 'vue';
import { Inbox } from 'lucide-vue-next';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  { title: '暂无内容', description: undefined }
);

const attrs = useAttrs();
</script>

<template>
  <div
    v-bind="{ ...attrs, class: undefined }"
    :class="cx('flex flex-col items-center justify-center text-center px-6 py-12', attrs.class as string | undefined)"
  >
    <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
      <slot name="icon">
        <Inbox class="w-6 h-6" aria-hidden="true" />
      </slot>
    </div>
    <h3 class="text-sm font-semibold text-slate-800">{{ title }}</h3>
    <p v-if="description" class="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">{{ description }}</p>
    <div v-if="$slots.action" class="mt-5">
      <slot name="action" />
    </div>
  </div>
</template>
