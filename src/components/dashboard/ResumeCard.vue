<script setup lang="ts">
import { computed } from 'vue';
import { AppBadge, AppCard, AppMenu } from '../ui';
import ResumeCardThumb from './ResumeCardThumb.vue';
import { findTemplate } from '../../constants/templates';
import type { ResumeSummary } from '../../composables/useResumes';
import {
  Activity,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Lock,
  MoreHorizontal,
  Share2,
  Trash2,
  TrendingUp
} from 'lucide-vue-next';

/**
 * 工作台单张简历卡片。
 *
 * 网格与列表共用同一份结构，只有 `mode` 决定排版密度与哪些区块显示：
 * 列表模式省掉完整度与统计块，一屏能看十几份，适合「按岗位维护多份简历」的用法。
 */
const props = withDefaults(
  defineProps<{
    item: ResumeSummary;
    busy?: boolean;
    mode?: 'grid' | 'list';
    menuOpen?: boolean;
  }>(),
  { busy: false, mode: 'grid', menuOpen: false }
);

const emit = defineEmits<{
  (e: 'update:menuOpen', value: boolean): void;
  (e: 'rename'): void;
  (e: 'duplicate'): void;
  (e: 'delete'): void;
  (e: 'share-settings'): void;
  (e: 'toggle-share'): void;
  (e: 'analytics'): void;
}>();

const template = computed(() => findTemplate(props.item.templateId));
const isList = computed(() => props.mode === 'list');
const isPublic = computed(() => props.item.isPublic === 1);

const completeness = computed(() => props.item.completeness);
const completenessTone = computed(() => {
  const score = completeness.value?.score ?? 0;
  if (score >= 80) return 'bg-success-500';
  if (score >= 50) return 'bg-warning-500';
  return 'bg-danger-500';
});

/** 缺失项 key → 中文提示，只取前两项，避免卡片被撑高 */
const MISSING_LABELS: Record<string, string> = {
  name: '姓名',
  jobTitle: '求职意向',
  contact: '联系方式',
  summary: '个人简介',
  experience: '工作/项目经历',
  education: '教育经历',
  skills: '技能',
  metric: '量化数据'
};

const missingHint = computed(() =>
  (completeness.value?.missing ?? [])
    .slice(0, 2)
    .map((key) => MISSING_LABELS[key] ?? key)
    .join('、')
);

function formatTime(time: string | number) {
  const seconds = typeof time === 'number' ? time : Number(time);
  if (!Number.isFinite(seconds)) return String(time);
  const date = new Date(seconds * 1000);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
</script>

<template>
  <AppCard
    :padding="isList ? 'sm' : 'md'"
    class="flex flex-col"
    :class="busy && 'opacity-70'"
  >
    <div class="flex items-start gap-3">
      <div class="shrink-0" :class="isList ? 'w-10' : 'w-12'">
        <ResumeCardThumb :template="template" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <AppBadge tone="neutral">{{ template.shortName }}</AppBadge>
          <AppBadge :tone="isPublic ? 'success' : 'neutral'" dot>
            <component :is="isPublic ? Globe : Lock" class="w-3 h-3" aria-hidden="true" />
            {{ isPublic ? '公开' : '私有' }}
          </AppBadge>
        </div>

        <h2 class="font-bold text-slate-900 truncate" :class="isList ? 'text-xs mt-1' : 'text-sm mt-2'" :title="item.title">
          {{ item.title }}
        </h2>

        <p class="text-2xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
          <FileText class="w-3 h-3" aria-hidden="true" />
          <span>更新于 {{ formatTime(item.updatedAt) }}</span>
          <template v-if="isList">
            <span class="text-slate-300" aria-hidden="true">·</span>
            <span class="font-mono">{{ item.stats.totalViews }} 浏览</span>
            <template v-if="completeness">
              <span class="text-slate-300" aria-hidden="true">·</span>
              <span :class="completeness.score >= 80 ? 'text-success-700' : 'text-warning-700'">
                完整度 {{ completeness.score }}%
              </span>
            </template>
          </template>
        </p>
      </div>

      <AppMenu :open="menuOpen" aria-label="简历操作" @update:open="emit('update:menuOpen', $event)">
        <template #trigger="{ open }">
          <button
            type="button"
            class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="更多操作"
            :aria-expanded="open"
            @click.stop="emit('update:menuOpen', !open)"
          >
            <MoreHorizontal class="w-4 h-4" />
          </button>
        </template>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="emit('rename')"
        >
          <Edit3 class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>重命名</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="emit('duplicate')"
        >
          <Copy class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>复制一份副本</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-600 hover:bg-danger-50"
          @click="emit('delete')"
        >
          <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
          <span>删除</span>
        </button>
      </AppMenu>
    </div>

    <!-- 完整度：只提示「还差什么」，不做质量评价 -->
    <div v-if="!isList && completeness" class="mt-3">
      <div class="flex items-center justify-between gap-2 text-2xs">
        <span class="text-slate-500 truncate">
          完整度<span v-if="missingHint"> · 还缺 {{ missingHint }}</span>
        </span>
        <span class="font-mono font-bold text-slate-700 shrink-0">{{ completeness.score }}%</span>
      </div>
      <div class="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-[width] duration-300"
          :class="completenessTone"
          :style="{ width: `${completeness.score}%` }"
        />
      </div>
    </div>

    <!-- 在线访问统计 -->
    <button
      v-if="!isList"
      type="button"
      class="mt-3 p-2.5 rounded-lg bg-slate-50 hover:bg-primary-50/60 border border-slate-100 text-left transition"
      @click="emit('analytics')"
    >
      <!--
        用 sr-only 前缀补全语境，而不是 aria-label：
        aria-label 会覆盖可见文字，导致「按钮里看到的字不在可访问名里」（axe label-content-name-mismatch）。
        这里不写简历标题：卡片标题已经是同页可见文本，重复一遍会让读屏连读两遍。
      -->
      <span class="sr-only">查看这份简历的在线访问统计：</span>
      <div class="flex items-center gap-3 text-2xs text-slate-600">
        <span class="flex items-center gap-1">
          <Eye class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span class="font-bold font-mono">{{ item.stats.totalViews }}</span> 浏览
        </span>
        <span class="flex items-center gap-1">
          <Activity class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span class="font-bold font-mono">{{ item.stats.avgDuration }}s</span> 均长
        </span>
        <span class="flex items-center gap-1 ml-auto text-primary-600 font-semibold">
          <TrendingUp class="w-3 h-3" aria-hidden="true" />
          <span>统计</span>
        </span>
      </div>
    </button>

    <div
      class="flex items-center justify-between gap-2"
      :class="isList ? 'mt-2' : 'mt-4 pt-3 border-t border-slate-100'"
    >
      <router-link
        :to="`/editor/${item.id}`"
        class="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition"
      >
        <Edit3 class="w-3.5 h-3.5" aria-hidden="true" />
        <span>编辑</span>
      </router-link>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          :aria-label="isPublic ? '关闭公开分享' : '开启公开分享'"
          @click="emit('toggle-share')"
        >
          <component :is="isPublic ? Globe : Lock" class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="分享设置"
          @click="emit('share-settings')"
        >
          <Share2 class="w-3.5 h-3.5" />
        </button>
        <router-link
          :to="`/share/${item.id}`"
          target="_blank"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          aria-label="打开在线只读页"
        >
          <ExternalLink class="w-3.5 h-3.5" />
        </router-link>
      </div>
    </div>
  </AppCard>
</template>
