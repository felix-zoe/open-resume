<script setup lang="ts">
import { useAttrs, useId } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
  }>(),
  { modelValue: false, label: undefined, description: undefined, disabled: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const attrs = useAttrs();
const autoId = useId();

const toggle = () => {
  if (props.disabled) return;
  emit('update:modelValue', !props.modelValue);
};
</script>

<template>
  <div :class="cx('flex items-center justify-between gap-3', attrs.class as string | undefined)">
    <div v-if="label || description" class="min-w-0">
      <label :for="autoId" class="block text-xs font-semibold text-slate-700">{{ label }}</label>
      <p v-if="description" class="text-2xs text-slate-500 mt-0.5 leading-relaxed">{{ description }}</p>
    </div>

    <button
      :id="autoId"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      :class="cx(
        'relative inline-flex shrink-0 w-9 h-5 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1',
        modelValue ? 'bg-primary-600' : 'bg-slate-300',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )"
      @click="toggle"
    >
      <span
        :class="cx(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform',
          modelValue && 'translate-x-4'
        )"
      />
    </button>
  </div>
</template>
