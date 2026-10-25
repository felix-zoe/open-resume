<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { cx } from './utils';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    /** 抽屉宽度类 */
    widthClass?: string;
    closeOnOverlay?: boolean;
  }>(),
  { title: undefined, widthClass: 'w-80', closeOnOverlay: true }
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'close'): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
let previousOverflow = '';

function close() {
  emit('update:open', false);
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key === 'Tab' && panelRef.value) {
    const focusable = panelRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
      await nextTick();
      panelRef.value?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true);
  if (props.open) document.body.style.overflow = previousOverflow;
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 no-print">
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeOnOverlay && close()"
        />

        <aside
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          :class="cx(
            'absolute right-0 top-0 h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col outline-none',
            'transition-transform duration-200',
            widthClass
          )"
        >
          <header class="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
            <h2 class="text-sm font-bold text-slate-900">{{ title }}</h2>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="关闭"
              @click="close"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto px-4 py-4">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="px-4 py-3 border-t border-slate-100 shrink-0">
            <slot name="footer" />
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
