<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Plus, Trash2, ArrowUp, ArrowDown, Sparkles, X } from 'lucide-vue-next';
import { AppButton, AppInput, AppTextarea } from '../ui';

/**
 * 结构化 bullet 编辑器。
 *
 * 为什么不用一个大 textarea：描述是「一行一条」的结构，用 textarea 时用户
 * 换行靠自觉（有人用 `•`、有人用 `-`、有人不换行），检查器也就没法按行定位。
 * 这里把每行拆成独立输入框，同时保证**输出仍是换行分隔的字符串** ——
 * 数据模型不变，各套模板与导出的解析逻辑都不用改。
 */

const props = withDefaults(
  defineProps<{
    modelValue: string;
    /** 每条建议的占位提示 */
    placeholder?: string;
    /** 是否显示 STAR 辅助输入 */
    star?: boolean;
  }>(),
  { placeholder: '一条一条写：做了什么 + 带来什么结果（带数字）', star: true }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

/** 去掉行首的 bullet 符号，编辑器自己提供视觉上的圆点 */
function stripBullet(line: string): string {
  return line.replace(/^[-•·*]\s*/, '');
}

const lines = ref<string[]>([]);

/** 外部值变化时同步（例如导入、版本恢复、撤销） */
watch(
  () => props.modelValue,
  (value) => {
    const next = String(value || '')
      .split('\n')
      .map(stripBullet);
    // 内容一致就不重建，避免输入时每敲一个字都把光标顶掉
    if (next.join('\n') !== lines.value.join('\n')) lines.value = next;
  },
  { immediate: true }
);

function commit() {
  // 保留空行位置，但去掉末尾多余空行：用户可能正在中间插入新条目
  const cleaned = [...lines.value];
  while (cleaned.length && !cleaned[cleaned.length - 1].trim()) cleaned.pop();
  emit('update:modelValue', cleaned.map((line) => line.trimEnd()).join('\n'));
}

function updateLine(index: number, value: string) {
  lines.value[index] = value;
  commit();
}

function addLine() {
  lines.value.push('');
  commit();
}

function removeLine(index: number) {
  lines.value.splice(index, 1);
  if (!lines.value.length) lines.value.push('');
  commit();
}

function moveLine(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= lines.value.length) return;
  const next = [...lines.value];
  [next[index], next[target]] = [next[target], next[index]];
  lines.value = next;
  commit();
}

// ---------------- STAR 辅助 ----------------
const showStar = ref(false);
const star = ref({ situation: '', task: '', action: '', result: '' });

const starPreview = computed(() => {
  const { situation, task, action, result } = star.value;
  const head = [situation, task].filter(Boolean).join('，');
  const body = [action, result].filter(Boolean).join('，');
  return [head, body].filter(Boolean).join('；');
});

function appendStar() {
  const text = starPreview.value.trim();
  if (!text) return;
  // 追加到第一条空行，没有空行就新增
  const emptyIndex = lines.value.findIndex((line) => !line.trim());
  if (emptyIndex >= 0) lines.value[emptyIndex] = text;
  else lines.value.push(text);
  commit();
  star.value = { situation: '', task: '', action: '', result: '' };
  showStar.value = false;
}
</script>

<template>
  <div class="space-y-1.5">
    <ul class="space-y-1.5">
      <li v-for="(line, index) in lines" :key="index" class="flex items-start gap-1">
        <span class="text-slate-300 text-2xs pt-2 select-none" aria-hidden="true">•</span>
        <AppTextarea
          :model-value="line"
          :rows="1"
          :placeholder="placeholder"
          :aria-label="`第 ${index + 1} 条描述`"
          class="flex-1"
          @update:model-value="(value: string) => updateLine(index, value)"
        />
        <div class="flex flex-col shrink-0">
          <button
            type="button"
            class="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25"
            :disabled="index === 0"
            :aria-label="`上移第 ${index + 1} 条`"
            @click="moveLine(index, -1)"
          >
            <ArrowUp class="w-3 h-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25"
            :disabled="index === lines.length - 1"
            :aria-label="`下移第 ${index + 1} 条`"
            @click="moveLine(index, 1)"
          >
            <ArrowDown class="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          class="p-1 rounded text-slate-400 hover:text-danger-600 shrink-0"
          :aria-label="`删除第 ${index + 1} 条`"
          @click="removeLine(index)"
        >
          <Trash2 class="w-3 h-3" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <div class="flex items-center gap-2 pt-0.5">
      <button
        type="button"
        class="inline-flex items-center gap-1 text-2xs font-medium text-primary-600 hover:text-primary-700"
        @click="addLine"
      >
        <Plus class="w-3 h-3" aria-hidden="true" />
        <span>添加一条</span>
      </button>

      <button
        v-if="star"
        type="button"
        class="inline-flex items-center gap-1 text-2xs font-medium text-slate-500 hover:text-slate-700"
        :aria-expanded="showStar"
        @click="showStar = !showStar"
      >
        <Sparkles class="w-3 h-3" aria-hidden="true" />
        <span>STAR 辅助</span>
      </button>
    </div>

    <!--
      STAR 辅助：四个格子分别写情境/任务/行动/结果，拼成一句后插入。
      这里**不预填任何句式模板**（旧实现的 `[核心模块]` 占位符经常被漏改），
      用户写什么就是什么。
    -->
    <div v-if="star && showStar" class="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-2xs font-semibold text-slate-600">按 STAR 拆开写，自动拼成一句话</span>
        <button
          type="button"
          class="p-0.5 rounded text-slate-400 hover:text-slate-700"
          aria-label="关闭 STAR 辅助"
          @click="showStar = false"
        >
          <X class="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <AppInput v-model="star.situation" size="sm" placeholder="情境：在什么背景下" aria-label="情境" />
        <AppInput v-model="star.task" size="sm" placeholder="任务：要解决什么问题" aria-label="任务" />
        <AppInput v-model="star.action" size="sm" placeholder="行动：你具体做了什么" aria-label="行动" />
        <AppInput v-model="star.result" size="sm" placeholder="结果：带来什么变化（带数字）" aria-label="结果" />
      </div>
      <p v-if="starPreview" class="text-2xs text-slate-600 leading-relaxed break-words">
        预览：{{ starPreview }}
      </p>
      <div class="flex items-center justify-end">
        <AppButton size="sm" :disabled="!starPreview" @click="appendStar">插入这条</AppButton>
      </div>
    </div>
  </div>
</template>
