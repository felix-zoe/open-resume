<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, Equal } from 'lucide-vue-next';
import { diffLines, summarizeDiff } from '../../utils/diff';

/**
 * 改写前后的差异对照。
 *
 * 这是 T5.7 的核心约束落点：AI 改写**必须展示 diff 并由用户确认**。
 * 只给一段新文字让人自己找不同，等于默认接受模型可能塞进来的东西 ——
 * 而简历里每句话都会被面试官追问。
 *
 * 渲染的是「行 + 行内片段」的扁平列表而不是左右两栏：简历描述本来就是
 * 一行一条要点，左右分栏在窄屏（编辑器抽屉只有 20 余 rem）会把每行挤成
 * 三四个字换一行，反而看不清。
 */

const props = defineProps<{
  before: string;
  after: string;
}>();

const lines = computed(() => diffLines(props.before, props.after));
const stats = computed(() => summarizeDiff(props.before, props.after));
const isUnchanged = computed(() => props.before.trim() === props.after.trim());

const MARKER: Record<string, string> = {
  same: ' ',
  add: '+',
  remove: '−'
};
</script>

<template>
  <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
    <!-- 汇总条 -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
      <div class="flex items-center gap-2 text-2xs">
        <span class="inline-flex items-center gap-1 font-mono font-semibold text-success-700">
          <span aria-hidden="true">+</span>{{ stats.added }}
        </span>
        <span class="inline-flex items-center gap-1 font-mono font-semibold text-danger-700">
          <span aria-hidden="true">−</span>{{ stats.removed }}
        </span>
      </div>
      <span class="text-2xs text-slate-500">
        <template v-if="isUnchanged">模型认为无需改动</template>
        <template v-else>
          {{ props.before.replace(/\s/g, '').length }} 字
          <ArrowRight class="inline w-3 h-3 -mt-0.5 mx-0.5" aria-hidden="true" />
          {{ props.after.replace(/\s/g, '').length }} 字
          <span v-if="stats.lengthDelta" class="ml-1 font-mono">
            （{{ stats.lengthDelta > 0 ? '+' : '' }}{{ stats.lengthDelta }}）
          </span>
        </template>
      </span>
    </div>

    <!-- 逐行差异 -->
    <ul v-if="!isUnchanged" class="max-h-80 overflow-y-auto divide-y divide-slate-100">
      <li
        v-for="(line, index) in lines"
        :key="index"
        class="flex items-start gap-2 px-3 py-1.5 text-xs leading-relaxed"
        :class="line.op === 'add' ? 'bg-success-50/70' : line.op === 'remove' ? 'bg-danger-50/70' : ''"
      >
        <span
          class="shrink-0 w-3 font-mono select-none"
          :class="line.op === 'add' ? 'text-success-600' : line.op === 'remove' ? 'text-danger-600' : 'text-slate-300'"
          aria-hidden="true"
        >
          {{ MARKER[line.op] }}
        </span>
        <span class="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-700">
          <template v-for="(segment, segIndex) in line.segments" :key="segIndex">
            <span
              v-if="segment.op === 'remove'"
              class="bg-danger-200/80 text-danger-900 rounded-sm"
            >{{ segment.text }}</span>
            <span
              v-else-if="segment.op === 'add'"
              class="bg-success-200/80 text-success-900 rounded-sm font-medium"
            >{{ segment.text }}</span>
            <span v-else>{{ segment.text }}</span>
          </template>
          <span v-if="!line.segments.length" class="text-slate-400">（空行）</span>
        </span>
      </li>
    </ul>

    <p v-else class="px-3 py-4 text-xs text-slate-500 flex items-center gap-1.5">
      <Equal class="w-3.5 h-3.5" aria-hidden="true" />
      <span>改写结果与原文一致，可以直接点「放弃」。</span>
    </p>
  </div>
</template>