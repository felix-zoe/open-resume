<script setup lang="ts">
import { useChoiceState, resolveChoice } from '../../composables/useChoice';
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

const state = useChoiceState();

// 遮罩 / Esc 关闭等同「不改动」，返回 null 由调用方决定怎么处理
function cancel() {
  resolveChoice(null);
}
</script>

<template>
  <AppModal :open="!!state" :title="state?.title" size="sm" @close="cancel">
    <p v-if="state?.description" class="text-xs text-slate-600 leading-relaxed mb-4">
      {{ state.description }}
    </p>

    <div class="space-y-2">
      <button
        v-for="option in state?.options ?? []"
        :key="option.value"
        type="button"
        class="w-full text-left px-3.5 py-3 rounded-lg border transition"
        :class="
          option.tone === 'primary'
            ? 'border-primary-200 bg-primary-50/60 hover:bg-primary-50 hover:border-primary-300'
            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
        "
        @click="resolveChoice(option.value)"
      >
        <span class="block text-xs font-bold text-slate-900">{{ option.label }}</span>
        <span v-if="option.description" class="block text-2xs text-slate-500 mt-0.5 leading-relaxed">
          {{ option.description }}
        </span>
      </button>
    </div>

    <template #footer>
      <AppButton variant="ghost" size="sm" @click="cancel">稍后再说</AppButton>
    </template>
  </AppModal>
</template>
