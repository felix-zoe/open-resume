<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { cx } from './utils';

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    tabs: TabItem[];
    /** 撑满容器，用于移动端「内容/预览」切换 */
    block?: boolean;
    ariaLabel?: string;
  }>(),
  { block: false, ariaLabel: '选项卡' }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const tabRefs = ref<HTMLElement[]>([]);

const enabledIndexes = computed(() =>
  props.tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => !tab.disabled)
);

function select(key: string) {
  emit('update:modelValue', key);
}

/** 方向键在可用 Tab 之间移动（roving tabindex） */
function onKeydown(event: KeyboardEvent, index: number) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();

  const list = enabledIndexes.value;
  if (!list.length) return;
  const currentPos = Math.max(0, list.findIndex((entry) => entry.index === index));

  let nextPos = currentPos;
  if (event.key === 'ArrowLeft') nextPos = (currentPos - 1 + list.length) % list.length;
  if (event.key === 'ArrowRight') nextPos = (currentPos + 1) % list.length;
  if (event.key === 'Home') nextPos = 0;
  if (event.key === 'End') nextPos = list.length - 1;

  const next = list[nextPos];
  select(next.tab.key);
  nextTick(() => tabRefs.value[next.index]?.focus());
}

watch(
  () => props.tabs,
  () => {
    tabRefs.value = tabRefs.value.slice(0, props.tabs.length);
  }
);
</script>

<template>
  <div
    role="tablist"
    :aria-label="ariaLabel"
    :class="cx('inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl', block && 'flex w-full')"
  >
    <button
      v-for="(tab, index) in tabs"
      :key="tab.key"
      :ref="(el) => (tabRefs[index] = el as HTMLElement)"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.key"
      :tabindex="modelValue === tab.key ? 0 : -1"
      :disabled="tab.disabled"
      :class="cx(
        'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        modelValue === tab.key
          ? 'bg-white text-slate-900 shadow-xs'
          : 'text-slate-600 hover:text-slate-900',
        block && 'flex-1'
      )"
      @click="select(tab.key)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
