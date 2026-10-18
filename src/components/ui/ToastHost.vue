<script setup lang="ts">
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';
import { useToast, type ToastItem } from '../../composables/useToast';
import { cx } from './utils';

const { items, dismiss } = useToast();

const TONE_STYLES: Record<ToastItem['tone'], string> = {
  success: 'border-success-200 bg-white text-slate-800',
  error: 'border-danger-200 bg-white text-slate-800',
  info: 'border-slate-200 bg-white text-slate-800'
};

const ICON_STYLES: Record<ToastItem['tone'], string> = {
  success: 'text-success-600',
  error: 'text-danger-600',
  info: 'text-primary-600'
};

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
} as const;
</script>

<template>
  <!-- aria-live=polite：不打断读屏当前朗读 -->
  <div
    class="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full max-w-sm px-4 no-print pointer-events-none"
    aria-live="polite"
    aria-atomic="false"
  >
    <TransitionGroup
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-for="item in items"
        :key="item.id"
        :class="cx(
          'pointer-events-auto w-full flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-lg',
          TONE_STYLES[item.tone]
        )"
      >
        <component
          :is="ICONS[item.tone]"
          :class="cx('w-4 h-4 shrink-0 mt-0.5', ICON_STYLES[item.tone])"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium leading-relaxed break-words">{{ item.message }}</p>
          <p
            v-if="item.selectableText"
            class="mt-1.5 text-2xs font-mono text-slate-500 break-all select-all"
          >
            {{ item.selectableText }}
          </p>
        </div>
        <button
          type="button"
          class="p-0.5 rounded text-slate-400 hover:text-slate-600 transition shrink-0"
          aria-label="关闭提示"
          @click="dismiss(item.id)"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
