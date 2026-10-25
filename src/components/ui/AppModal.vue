<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { cx } from './utils';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    /** 点击遮罩是否关闭，默认 true */
    closeOnOverlay?: boolean;
    closeOnEsc?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    title: undefined,
    description: undefined,
    closeOnOverlay: true,
    closeOnEsc: true,
    size: 'md'
  }
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'close'): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
let previousOverflow = '';

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl'
} as const;

const panelClass = computed(() => cx('w-full', SIZE_CLASSES[props.size]));

function close() {
  emit('update:open', false);
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return;

  if (event.key === 'Escape' && props.closeOnEsc) {
    event.stopPropagation();
    close();
    return;
  }

  // 焦点陷阱：Tab 在对话框内循环
  if (event.key === 'Tab' && panelRef.value) {
    const focusable = panelRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
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

function lockBody() {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
}

function unlockBody() {
  document.body.style.overflow = previousOverflow;
}

function restoreFocus() {
  previouslyFocused?.focus?.();
  previouslyFocused = null;
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      lockBody();
      document.addEventListener('keydown', onKeydown, true);
      await nextTick();
      // 优先聚焦表单控件（用户来这里是填东西的），没有才退到面板本身
      const firstField = panelRef.value?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      (firstField ?? panelRef.value)?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown, true);
      unlockBody();
      restoreFocus();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true);
  if (props.open) unlockBody();
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
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
        <div
          class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeOnOverlay && close()"
        />

        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          :class="cx(
            'relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col outline-none',
            panelClass
          )"
        >
          <header
            v-if="title || $slots.header"
            class="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100"
          >
            <div class="min-w-0">
              <slot name="header">
                <h2 class="text-sm font-bold text-slate-900">{{ title }}</h2>
                <p v-if="description" class="text-2xs text-slate-500 mt-1 leading-relaxed">{{ description }}</p>
              </slot>
            </div>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0"
              aria-label="关闭"
              @click="close"
            >
              <X class="w-4 h-4" />
            </button>
          </header>

          <div class="px-5 py-4 overflow-y-auto flex-1">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="px-5 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
