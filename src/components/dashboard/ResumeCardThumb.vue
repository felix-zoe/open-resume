<script setup lang="ts">
import { computed } from 'vue';
import type { TemplateMeta } from '../../constants/templates';

/**
 * 工作台卡片的版式缩略图。
 *
 * 不挂真实模板组件：一个列表可能有十几张卡片，每张都挂一份完整模板
 * （含 ResizeObserver 与整套排版计算）会让首屏明显变慢。这里用极简的
 * CSS 色块表达「单栏 / 双栏 / 有无头像 / 有无强调色」四个真实差异，
 * 用户一眼能区分四套模板，成本是几个 div。
 */
const props = defineProps<{ template: TemplateMeta }>();

const isTwoColumn = computed(() => props.template.columns === 2);
const hasPhoto = computed(() => props.template.photo);
const isAts = computed(() => props.template.atsSafe);
</script>

<template>
  <div
    class="resume-thumb relative w-full aspect-[210/297] rounded-lg border border-slate-200 bg-white overflow-hidden"
    :class="template.accent"
    aria-hidden="true"
  >
    <div class="absolute inset-0 p-2 flex flex-col gap-1">
      <!-- 头部：头像 + 姓名条 -->
      <div class="flex items-center gap-1" :class="isTwoColumn ? 'justify-start' : 'justify-center'">
        <div v-if="hasPhoto" class="w-3 h-3 rounded-full bg-slate-400/50 shrink-0" />
        <div class="space-y-0.5" :class="isTwoColumn ? 'flex-1' : 'w-1/2'">
          <div class="h-1 rounded-sm bg-slate-500/60" :class="isTwoColumn ? 'w-2/3' : 'w-full'" />
          <div class="h-0.5 rounded-sm bg-slate-400/40 w-1/2" :class="isTwoColumn ? '' : 'mx-auto'" />
        </div>
      </div>

      <div class="flex-1 flex gap-1 min-h-0">
        <!-- 双栏：左侧栏 -->
        <div v-if="isTwoColumn" class="w-1/3 space-y-1 pt-1">
          <div class="h-0.5 rounded-sm bg-slate-400/50 w-full" />
          <div class="h-0.5 rounded-sm bg-slate-400/40 w-4/5" />
          <div class="h-0.5 rounded-sm bg-slate-400/40 w-3/5" />
          <div class="h-0.5 rounded-sm bg-slate-400/40 w-4/5" />
        </div>

        <!-- 主栏：模块标题 + 若干条目行 -->
        <div class="flex-1 space-y-1 pt-1">
          <template v-for="block in 3" :key="block">
            <div
              class="h-0.5 rounded-sm"
              :class="isAts ? 'bg-slate-500/70 w-1/3' : 'bg-slate-500/60 w-2/5'"
            />
            <div class="h-0.5 rounded-sm bg-slate-300/70 w-full" />
            <div class="h-0.5 rounded-sm bg-slate-300/70 w-5/6" />
          </template>
        </div>
      </div>
    </div>

    <!-- ATS 模板没有强调色，用一条浅灰底边提示「机器可读」 -->
    <div v-if="isAts" class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-300" />
  </div>
</template>
