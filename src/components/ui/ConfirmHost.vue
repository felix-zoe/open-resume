<script setup lang="ts">
import { useConfirmState, resolveConfirm } from '../../composables/useConfirm';
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

const state = useConfirmState();

// Esc / 遮罩关闭都视为“取消”（由 AppModal 的 close 事件触发）
function cancel() {
  resolveConfirm(false);
}

function confirm() {
  resolveConfirm(true);
}
</script>

<template>
  <AppModal
    :open="!!state"
    :title="state?.title"
    size="sm"
    :close-on-overlay="true"
    @close="cancel"
  >
    <p v-if="state?.description" class="text-xs text-slate-600 leading-relaxed">
      {{ state.description }}
    </p>

    <template #footer>
      <AppButton variant="secondary" size="sm" @click="cancel">
        {{ state?.cancelText }}
      </AppButton>
      <AppButton
        :variant="state?.tone === 'danger' ? 'danger' : 'primary'"
        size="sm"
        @click="confirm"
      >
        {{ state?.confirmText }}
      </AppButton>
    </template>
  </AppModal>
</template>
