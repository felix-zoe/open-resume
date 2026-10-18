<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    label?: string;
    disabled?: boolean;
    id?: string;
  }>(),
  { modelValue: false, label: undefined, disabled: false, id: undefined }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const attrs = useAttrs();
const autoId = useId();
const inputId = computed(() => props.id ?? autoId);
const inputAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});
</script>

<template>
  <label
    :for="inputId"
    :class="cx('inline-flex items-center gap-2 select-none', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', attrs.class as string | undefined)"
  >
    <input
      :id="inputId"
      v-bind="inputAttrs"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 accent-primary-600 focus-visible:ring-2 focus-visible:ring-primary-500/40"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span v-if="label || $slots.default" class="text-xs text-slate-600">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
