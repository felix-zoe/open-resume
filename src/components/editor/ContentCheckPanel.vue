<script setup lang="ts">
import { computed, ref } from 'vue';
import { AlertCircle, CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppDrawer, AppBadge, AppSwitch, AppButton } from '../ui';
import {
  checkBullets,
  summarizeIssues,
  MAX_BULLET_LENGTH,
  type BulletIssue,
  type BulletIssueKind
} from '../../utils/contentCheck';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const resumeStore = useResumeStore();

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

/**
 * 检查项开关：默认全开。
 * 用户觉得某条规则太吵时可以关掉，而不是被迫接受一堆「建议」。
 */
const enabled = ref<Record<BulletIssueKind, boolean>>({
  'no-metric': true,
  'weak-verb': true,
  'too-long': true,
  placeholder: true,
  'empty-verb': true,
  vague: true
});

const RULE_LABELS: Array<{ kind: BulletIssueKind; label: string; description: string }> = [
  { kind: 'placeholder', label: '占位符残留', description: '如 [核心模块]、XX% 未替换' },
  { kind: 'weak-verb', label: '弱动词', description: '负责 / 参与 / 协助 开头' },
  { kind: 'no-metric', label: '缺少量化', description: '没有数字、百分比或规模' },
  { kind: 'too-long', label: '描述过长', description: `单条超过 ${MAX_BULLET_LENGTH} 字` },
  { kind: 'vague', label: '空洞表述', description: '「相关工作」「若干」这类词' }
];

const issues = computed(() =>
  checkBullets(resumeStore.content, { enabled: enabled.value })
);

const total = computed(() => issues.value.length);

/** 按类型计数，用于在规则开关上标出「这条规则命中了多少」 */
const perRule = computed(() => summarizeIssues(issues.value));

/** 按模块 + 条目分组，避免同一段经历的问题散落在列表各处 */
const grouped = computed(() => {
  const map = new Map<string, { module: string; itemId: string; itemName: string; issues: BulletIssue[] }>();
  for (const issue of issues.value) {
    const key = `${issue.module}:${issue.itemId}`;
    if (!map.has(key)) {
      const mod = resumeStore.content.modules[issue.module];
      const item = mod.items.find((entry: any) => entry.id === issue.itemId) as any;
      const name = issue.module === 'work' ? item?.company : item?.name;
      map.set(key, {
        module: issue.module === 'work' ? '工作经历' : '项目经历',
        itemId: issue.itemId,
        itemName: name || '未命名条目',
        issues: []
      });
    }
    map.get(key)!.issues.push(issue);
  }
  return Array.from(map.values());
});

const collapsed = ref<Record<string, boolean>>({});

function toggleGroup(key: string) {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
}

const TONE_BY_KIND: Record<BulletIssueKind, 'warning' | 'danger' | 'neutral'> = {
  placeholder: 'danger',
  'weak-verb': 'warning',
  'no-metric': 'warning',
  'too-long': 'neutral',
  vague: 'warning',
  'empty-verb': 'warning'
};

const KIND_LABEL: Record<BulletIssueKind, string> = {
  placeholder: '占位符',
  'weak-verb': '弱动词',
  'no-metric': '缺量化',
  'too-long': '过长',
  vague: '空洞',
  'empty-verb': '无动词'
};
</script>

<template>
  <AppDrawer v-model:open="open" title="内容检查" width-class="w-[22rem]">
    <div class="space-y-4">
      <!-- 汇总 -->
      <div
        class="p-3 rounded-xl border"
        :class="total === 0 ? 'bg-success-50/60 border-success-100' : 'bg-warning-50/60 border-warning-100'"
      >
        <p class="flex items-center gap-1.5 text-xs font-bold" :class="total === 0 ? 'text-success-700' : 'text-warning-700'">
          <component :is="total === 0 ? CheckCircle2 : AlertCircle" class="w-4 h-4" aria-hidden="true" />
          <span>{{ total === 0 ? '没有发现明显问题' : `${total} 处可以改进` }}</span>
        </p>
        <p class="text-2xs text-slate-600 mt-1 leading-relaxed">
          逐条检查工作与项目描述。所有提示都只是建议，不影响导出。
        </p>
      </div>

      <!-- 问题列表 -->
      <div v-if="total > 0" class="space-y-2">
        <div
          v-for="group in grouped"
          :key="`${group.module}:${group.itemId}`"
          class="rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition text-left"
            :aria-expanded="!collapsed[`${group.module}:${group.itemId}`]"
            @click="toggleGroup(`${group.module}:${group.itemId}`)"
          >
            <span class="min-w-0">
              <span class="block text-xs font-semibold text-slate-800 truncate">{{ group.itemName }}</span>
              <span class="block text-2xs text-slate-500">{{ group.module }} · {{ group.issues.length }} 处</span>
            </span>
            <component
              :is="collapsed[`${group.module}:${group.itemId}`] ? ChevronDown : ChevronUp"
              class="w-4 h-4 text-slate-400 shrink-0"
              aria-hidden="true"
            />
          </button>

          <ul v-show="!collapsed[`${group.module}:${group.itemId}`]" class="divide-y divide-slate-100">
            <li v-for="(issue, index) in group.issues" :key="index" class="px-3 py-2 space-y-1">
              <div class="flex items-center gap-1.5">
                <AppBadge :tone="TONE_BY_KIND[issue.kind]">{{ KIND_LABEL[issue.kind] }}</AppBadge>
                <span class="text-2xs text-slate-500">第 {{ issue.lineIndex + 1 }} 行</span>
              </div>
              <p class="text-2xs text-slate-700 leading-relaxed break-words">{{ issue.text }}</p>
              <p class="text-2xs text-slate-500 leading-relaxed">{{ issue.message }}</p>
            </li>
          </ul>
        </div>
      </div>

      <!-- 规则开关 -->
      <div class="pt-3 border-t border-slate-100 space-y-3">
        <h3 class="text-2xs font-semibold text-slate-500 uppercase tracking-wide">检查项</h3>
        <AppSwitch
          v-for="rule in RULE_LABELS"
          :key="rule.kind"
          v-model="enabled[rule.kind]"
          :label="perRule[rule.kind] ? `${rule.label}（${perRule[rule.kind]}）` : rule.label"
          :description="rule.description"
        />
      </div>

      <p class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <Sparkles class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>这些规则基于关键词与正则，不理解语义。判断取舍仍然在你。</span>
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end">
        <AppButton size="sm" variant="secondary" @click="open = false">关闭</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
