<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    rows?: number;
    invalid?: boolean;
  }>(),
  { modelValue: '', rows: 4, invalid: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const attrs = useAttrs();

const classes = computed(() =>
  cx(
    'w-full bg-white border rounded-lg px-2.5 py-2 text-xs text-slate-900 leading-relaxed',
    'placeholder:text-slate-400 transition-colors outline-none resize-y',
    'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
    props.invalid
      ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
      : 'border-slate-200 hover:border-slate-300',
    attrs.class as string | undefined
  )
);

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
};
</script>

<template>
  <textarea
    v-bind="{ ...attrs, class: undefined }"
    :value="modelValue"
    :rows="rows"
    :class="classes"
    :aria-invalid="invalid || undefined"
    @input="onInput"
  />
</template>
