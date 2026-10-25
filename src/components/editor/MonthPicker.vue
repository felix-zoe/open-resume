<script setup lang="ts">
import { computed } from 'vue';

/**
 * 年月选择器 + “至今”。
 *
 * 为什么不用 `<input type="month">`：它的原生控件在不同浏览器里样式差异大，
 * 而且不能表达“至今”这种简历里的常见写法。
 *
 * 存储格式统一为 `YYYY.MM`；`present` 为 true 时值是“至今”。
 * 这样导出时不会出现 `2022.7` / `2022-07` / `2022年7月` 混排。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    /** 是否允许“至今”（结束时间用） */
    allowPresent?: boolean;
    /** 允许的最早年份 */
    minYear?: number;
    /** 允许的最晚年份 */
    maxYear?: number;
    placeholder?: string;
  }>(),
  {
    label: '',
    allowPresent: false,
    minYear: 1970,
    maxYear: () => new Date().getFullYear() + 5,
    placeholder: '选择年月',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const PRESENT = '至今';

const isPresent = computed(() => props.modelValue === PRESENT);

/** 把 `YYYY.MM` 拆成 { year, month }；非法或“至今”时返回 null */
const parsed = computed(() => {
  const match = /^(\d{4})\.(\d{2})$/.exec(props.modelValue ?? '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
});

const year = computed(() => parsed.value?.year ?? '');
const month = computed(() => parsed.value?.month ?? '');

const years = computed(() => {
  const list: number[] = [];
  for (let y = props.maxYear; y >= props.minYear; y -= 1) list.push(y);
  return list;
});

const months = Array.from({ length: 12 }, (_, i) => i + 1);

function emitValue(nextYear: number | '', nextMonth: number | '') {
  if (!nextYear || !nextMonth) {
    emit('update:modelValue', '');
    return;
  }
  emit('update:modelValue', `${nextYear}.${String(nextMonth).padStart(2, '0')}`);
}

function onYearChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emitValue(value ? Number(value) : '', month.value || 1);
}

function onMonthChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const fallbackYear = year.value || new Date().getFullYear();
  emitValue(fallbackYear, value ? Number(value) : '');
}

function togglePresent() {
  emit('update:modelValue', isPresent.value ? '' : PRESENT);
}

/** 无法解析的旧值（如 `2022-07`、`2022年7月`）也给出提示，避免静默丢失 */
const hasLegacyValue = computed(
  () => Boolean(props.modelValue) && !isPresent.value && parsed.value === null
);
</script>

<template>
  <div>
    <label v-if="label" class="block text-2xs font-medium text-slate-500 mb-0.5">{{ label }}</label>

    <div class="flex items-center gap-1">
      <template v-if="!isPresent">
        <select
          :value="year"
          :aria-label="label ? `${label}（年）` : '年份'"
          class="flex-1 min-w-0 px-1.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          @change="onYearChange"
        >
          <option value="">{{ placeholder }}</option>
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>

        <select
          :value="month"
          :aria-label="label ? `${label}（月）` : '月份'"
          class="w-16 shrink-0 px-1.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          @change="onMonthChange"
        >
          <option value="">月</option>
          <option v-for="m in months" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
        </select>
      </template>

      <span
        v-else
        class="flex-1 px-2 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded"
      >
        至今
      </span>

      <button
        v-if="allowPresent"
        type="button"
        class="shrink-0 px-1.5 py-1 text-2xs rounded border transition"
        :class="
          isPresent
            ? 'border-primary-300 bg-primary-50 text-primary-700'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
        "
        :aria-pressed="isPresent"
        @click="togglePresent"
      >
        至今
      </button>
    </div>

    <p v-if="hasLegacyValue" class="mt-0.5 text-2xs text-warning-600">
      当前值「{{ modelValue }}」格式不标准，重新选择后将统一为 YYYY.MM
    </p>
  </div>
</template>
