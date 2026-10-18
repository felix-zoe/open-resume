<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options?: SelectOption[];
    invalid?: boolean;
    placeholder?: string;
  }>(),
  { modelValue: '', options: () => [], invalid: false, placeholder: undefined }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const attrs = useAttrs();

const classes = computed(() =>
  cx(
    'w-full h-9 appearance-none bg-white border rounded-lg pl-2.5 pr-8 text-xs text-slate-900',
    'transition-colors outline-none cursor-pointer',
    'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
    props.invalid
      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
      : 'border-slate-200 hover:border-slate-300',
    attrs.class as string | undefined
  )
);

const onChange = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLSelectElement).value);
};
</script>

<template>
  <div class="relative">
    <select
      v-bind="{ ...attrs, class: undefined }"
      :value="modelValue"
      :class="classes"
      :aria-invalid="invalid || undefined"
      @change="onChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <ChevronDown
      class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
      aria-hidden="true"
    />
  </div>
</template>
