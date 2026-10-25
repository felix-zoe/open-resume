<script setup lang="ts">
import { computed } from 'vue';
import { AppButton, AppDrawer } from '../../components/ui';
import StylePanel from './StylePanel.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});
</script>

<template>
  <AppDrawer v-model:open="open" title="排版与样式调优" width-class="w-full max-w-sm">
    <StylePanel />

    <template #footer>
      <AppButton block @click="emit('close')">完成并应用</AppButton>
    </template>
  </AppDrawer>
</template>
