<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { cx } from './utils';

const props = withDefaults(
  defineProps<{
    open: boolean;
    align?: 'left' | 'right';
    widthClass?: string;
    ariaLabel?: string;
  }>(),
  { align: 'right', widthClass: 'w-48', ariaLabel: '菜单' }
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);

function close() {
  emit('update:open', false);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!props.open) return;
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) close();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const items = itemRefs.value.filter(Boolean);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const next = (current + delta + items.length) % items.length;
    items[next]?.focus();
  }
}

function bind() {
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onDocumentKeydown, true);
}

function unbind() {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  document.removeEventListener('keydown', onDocumentKeydown, true);
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      bind();
      await nextTick();
      itemRefs.value[0]?.focus();
    } else {
      unbind();
    }
  },
  { immediate: true }
);

onBeforeUnmount(unbind);
</script>

<template>
  <div ref="rootRef" class="relative">
    <slot name="trigger" :open="open" />

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        role="menu"
        :aria-label="ariaLabel"
        :class="cx(
          'absolute z-40 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden',
          align === 'right' ? 'right-0' : 'left-0',
          widthClass
        )"
      >
        <slot :close="close" :register-item="(el: HTMLElement) => itemRefs.push(el)" />
      </div>
    </Transition>
  </div>
</template>
