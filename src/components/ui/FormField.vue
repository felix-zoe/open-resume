<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue';
import { cx } from './utils';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label?: string;
    /** 字段说明，会作为 aria-describedby 的一部分 */
    hint?: string;
    /** 错误文案；非空时自动 aria-invalid */
    error?: string;
    required?: boolean;
    /** 与控件 id 关联；不传时自动生成 */
    id?: string;
  }>(),
  { label: undefined, hint: undefined, error: undefined, required: false, id: undefined }
);

const attrs = useAttrs();
const autoId = useId();
const fieldId = computed(() => props.id ?? autoId);
const hintId = computed(() => `${fieldId.value}-hint`);
const errorId = computed(() => `${fieldId.value}-error`);

const describedBy = computed(() => {
  const ids: string[] = [];
  if (props.hint) ids.push(hintId.value);
  if (props.error) ids.push(errorId.value);
  return ids.length ? ids.join(' ') : undefined;
});
</script>

<template>
  <div :class="cx('flex flex-col gap-1.5', attrs.class as string | undefined)">
    <label
      v-if="label"
      :for="fieldId"
      class="text-xs font-semibold text-slate-700 flex items-center gap-1"
    >
      <span>{{ label }}</span>
      <span v-if="required" class="text-danger-500" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only">必填</span>
    </label>

    <!-- 控件由父级通过默认插槽注入，并接收 id / aria-* -->
    <slot
      :id="fieldId"
      :described-by="describedBy"
      :invalid="!!error"
      :hint-id="hintId"
      :error-id="errorId"
    />

    <p v-if="hint && !error" :id="hintId" class="text-2xs text-slate-500 leading-relaxed">
      {{ hint }}
    </p>
    <p v-if="error" :id="errorId" class="text-2xs font-medium text-danger-600" role="alert">
      {{ error }}
    </p>
  </div>
</template>
