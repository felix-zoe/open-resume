<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AlertTriangle, Check, RefreshCw, Settings2, Sparkles, Wand2 } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppBadge, AppButton, AppDrawer, AppInput, AppSelect, FormField, type SelectOption } from '../ui';
import AiProviderForm from '../ai/AiProviderForm.vue';
import AiDiffView from '../ai/AiDiffView.vue';
import { AI_LIMITS, AI_REWRITE_STYLES, findRewriteStyle, type AiRewriteStyle, type AiRewriteTarget } from '../../../shared/ai';
import { describeAiConfig, isAiReady, loadAiConfig, saveAiConfig, type AiConfig } from '../../utils/aiConfig';
import { requestAiRewrite } from '../../utils/aiRewrite';
import { trackEvent } from '../../utils/telemetry';

/**
 * AI 改写抽屉（T5.7）。
 *
 * 交互只有三步：选一段内容 → 选一个改写方向 → 看 diff 决定要不要。
 *
 * 两个刻意的设计：
 * 1. **一次只处理一段**，不做「整份简历一键 AI 美化」。整份改写会把用户
 *    逐字写出来的原话一次性换掉，出了问题都不知道是哪句变的。
 * 2. **结果必须过 diff 才可能落地**：采纳是唯一的写入路径，而采纳按钮
 *    长在 diff 下面。模型说了什么都不重要，用户点头才算数。
 */

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const resumeStore = useResumeStore();

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const config = ref<AiConfig>(loadAiConfig());
const showSettings = ref(false);

/** 配置一改就落盘；写失败（隐身模式）也不打断使用，本次仍按内存里的值走 */
watch(config, (next) => saveAiConfig(next), { deep: true });

const ready = computed(() => isAiReady(config.value));

const style = ref<AiRewriteStyle>('polish');
const instruction = ref('');
const selectedKey = ref('');

const isGenerating = ref(false);
const errorMessage = ref('');
/** 改写结果；null 表示还没有结果 */
const suggestion = ref<string | null>(null);
/** 生成结果时送出去的那份原文，diff 必须以它为准而不是当前的字段值 */
const sentText = ref('');

interface RewriteTargetEntry {
  key: string;
  kind: AiRewriteTarget;
  label: string;
  text: string;
  apply: (text: string) => void;
}

/**
 * 可改写的段落清单。
 *
 * 只列「已经有内容」的段落：空段落让模型无中生有，正是这个功能最该避免的事。
 * 技能栏按「一行一条」拼接后一起送出去，单条技能只有几个字，改写没有意义。
 */
const targets = computed<RewriteTargetEntry[]>(() => {
  const list: RewriteTargetEntry[] = [];
  const content = resumeStore.content;

  const summary = String(content.profile?.summary ?? '').trim();
  if (summary) {
    list.push({
      key: 'summary',
      kind: 'summary',
      label: '个人简介',
      text: summary,
      apply: (text: string) => {
        content.profile.summary = text;
      }
    });
  }

  for (const item of content.modules?.work?.items ?? []) {
    const text = String(item.description ?? '').trim();
    if (!text) continue;
    list.push({
      key: `work:${item.id}`,
      kind: 'work',
      label: `工作经历 · ${item.company || '未命名公司'}`,
      text,
      apply: (value: string) => {
        item.description = value;
      }
    });
  }

  for (const item of content.modules?.projects?.items ?? []) {
    const text = String(item.description ?? '').trim();
    if (!text) continue;
    list.push({
      key: `project:${item.id}`,
      kind: 'project',
      label: `项目经历 · ${item.name || '未命名项目'}`,
      text,
      apply: (value: string) => {
        item.description = value;
      }
    });
  }

  const skills = (content.modules?.skills?.items ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (skills.length) {
    list.push({
      key: 'skills',
      kind: 'skills',
      label: `技能 · ${skills.length} 条`,
      text: skills.join('\n'),
      apply: (value: string) => {
        content.modules.skills.items = value
          .split('\n')
          .map((line) => line.replace(/^[-•·*]\s*/, '').trim())
          .filter(Boolean);
      }
    });
  }

  return list;
});

const targetOptions = computed<SelectOption[]>(() =>
  targets.value.map((entry) => ({ value: entry.key, label: entry.label }))
);

const styleOptions = computed<SelectOption[]>(() =>
  AI_REWRITE_STYLES.map((item) => ({ value: item.id, label: item.label }))
);

const currentTarget = computed(() =>
  targets.value.find((entry) => entry.key === selectedKey.value) ?? null
);

const currentStyle = computed(() => findRewriteStyle(style.value));

/** 选中项被删掉/内容清空时自动落到第一项，避免下拉停在空白上 */
watch(
  targets,
  (list) => {
    if (!list.some((entry) => entry.key === selectedKey.value)) {
      selectedKey.value = list[0]?.key ?? '';
    }
  },
  { immediate: true }
);

/** 换目标就把上一个结果丢掉：diff 两边必须说的是同一段内容 */
watch(selectedKey, () => {
  suggestion.value = null;
  errorMessage.value = '';
});

const tooLong = computed(
  () => (currentTarget.value?.text.length ?? 0) > AI_LIMITS.maxInputChars
);

async function handleGenerate() {
  const target = currentTarget.value;
  if (!target || isGenerating.value) return;

  errorMessage.value = '';
  suggestion.value = null;
  isGenerating.value = true;

  try {
    const result = await requestAiRewrite(config.value, {
      text: target.text,
      style: style.value,
      target: target.kind,
      instruction: instruction.value
    });

    if (!result.ok) {
      errorMessage.value = result.message;
      return;
    }
    sentText.value = target.text;
    suggestion.value = result.data?.text ?? '';
  } finally {
    isGenerating.value = false;
  }
}

function handleAdopt() {
  const target = currentTarget.value;
  if (!target || suggestion.value === null) return;

  target.apply(suggestion.value);
  trackEvent('ai.adopt');
  suggestion.value = null;
  errorMessage.value = '';
}

function handleDiscard() {
  suggestion.value = null;
  errorMessage.value = '';
}
</script>

<template>
  <AppDrawer v-model:open="open" title="AI 改写" width-class="w-[26rem]">
    <div class="space-y-4">
      <!-- 未配置：先接入模型 -->
      <div v-if="!ready" class="space-y-4">
        <div class="rounded-xl bg-primary-50/60 border border-primary-100 px-3 py-2.5">
          <p class="text-xs font-bold text-primary-800 flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
            <span>先接入一个模型</span>
          </p>
          <p class="text-2xs text-primary-700 mt-1 leading-relaxed">
            填入你自己的 API Key 即可使用。国内主流厂商都已内置，也可以接自建网关。
          </p>
        </div>
        <AiProviderForm :config="config" @update:config="config = $event" />
      </div>

      <!-- 已配置：改写流程 -->
      <template v-else>
        <!-- 当前模型 + 设置入口 -->
        <div class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <div class="min-w-0">
            <p class="text-2xs text-slate-500">当前模型</p>
            <p class="text-xs font-semibold text-slate-800 truncate" :title="describeAiConfig(config)">
              {{ describeAiConfig(config) }}
            </p>
          </div>
          <AppButton variant="ghost" size="sm" class="shrink-0" @click="showSettings = !showSettings">
            <template #icon>
              <Settings2 class="w-3.5 h-3.5" aria-hidden="true" />
            </template>
            <span>{{ showSettings ? '收起设置' : '设置' }}</span>
          </AppButton>
        </div>

        <div v-if="showSettings" class="rounded-xl border border-slate-200 p-3">
          <AiProviderForm compact :config="config" @update:config="config = $event" />
        </div>

        <!-- 没有可改写的段落 -->
        <div v-else-if="!targets.length" class="rounded-xl bg-warning-50/60 border border-warning-100 px-3 py-3">
          <p class="text-xs font-bold text-warning-800 flex items-center gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5" aria-hidden="true" />
            <span>还没有可改写的内容</span>
          </p>
          <p class="text-2xs text-warning-700 mt-1 leading-relaxed">
            先在左侧填写个人简介、工作经历或项目描述，再回来改写。
            空段落不会拿去做改写 —— 那只会让模型编出你没做过的事。
          </p>
        </div>

        <template v-else>
          <FormField label="改写哪一段" id="ai-target" required>
            <template #default="{ id }">
              <AppSelect :id="id" v-model="selectedKey" :options="targetOptions" />
            </template>
          </FormField>

          <FormField
            label="改写方向"
            id="ai-style"
            :hint="currentStyle?.hint"
          >
            <template #default="{ id, describedBy }">
              <AppSelect :id="id" v-model="style" :options="styleOptions" :aria-describedby="describedBy" />
            </template>
          </FormField>

          <FormField
            label="补充要求"
            id="ai-instruction"
            :hint="`选填，最多 ${AI_LIMITS.maxInstructionChars} 字，如「面向 B 端客户」「突出团队规模」`"
          >
            <template #default="{ id, describedBy }">
              <AppInput
                :id="id"
                v-model="instruction"
                :maxlength="AI_LIMITS.maxInstructionChars"
                placeholder="选填"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <!-- 原文预览 -->
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <span class="text-2xs font-semibold text-slate-600">原文</span>
              <span class="text-2xs text-slate-500 font-mono">{{ currentTarget?.text.length ?? 0 }} 字</span>
            </div>
            <p class="px-3 py-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {{ currentTarget?.text }}
            </p>
          </div>

          <p v-if="tooLong" class="text-2xs text-warning-700 leading-relaxed flex items-start gap-1.5">
            <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>这段内容超过 {{ AI_LIMITS.maxInputChars }} 字，请先分成几段再改写。</span>
          </p>

          <div class="flex items-center justify-end">
            <AppButton
              size="sm"
              :loading="isGenerating"
              :disabled="tooLong || !currentTarget"
              @click="handleGenerate"
            >
              <template #icon>
                <Wand2 class="w-3.5 h-3.5" aria-hidden="true" />
              </template>
              <span>{{ suggestion === null ? '开始改写' : '重新生成' }}</span>
            </AppButton>
          </div>

          <!-- 错误 -->
          <div v-if="errorMessage" class="rounded-xl bg-danger-50/70 border border-danger-100 px-3 py-2.5" role="alert">
            <p class="text-xs font-semibold text-danger-800 flex items-start gap-1.5">
              <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span class="break-words">{{ errorMessage }}</span>
            </p>
            <p class="text-2xs text-danger-700 mt-1 leading-relaxed">
              如果提示 Key 或地址有问题，点上方「设置」检查一下。
            </p>
          </div>

          <!-- 结果：diff + 采纳 -->
          <div v-if="suggestion !== null" class="space-y-2.5">
            <div class="flex items-center gap-2">
              <h3 class="text-xs font-bold text-slate-800">改动对照</h3>
              <AppBadge tone="primary">模型建议，尚未生效</AppBadge>
            </div>

            <AiDiffView :before="sentText" :after="suggestion" />

            <p class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
              <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning-500" aria-hidden="true" />
              <span>
                请逐行确认没有新增你未做过的事。模型可能补上不存在的数字，
                形如 <code>[请补充具体数据]</code> 的方括号是它留给你填的空。
              </span>
            </p>

            <div class="flex items-center gap-2">
              <AppButton size="sm" @click="handleAdopt">
                <template #icon>
                  <Check class="w-3.5 h-3.5" aria-hidden="true" />
                </template>
                <span>采纳改写</span>
              </AppButton>
              <AppButton variant="secondary" size="sm" @click="handleGenerate">
                <template #icon>
                  <RefreshCw class="w-3.5 h-3.5" aria-hidden="true" />
                </template>
                <span>换一版</span>
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="handleDiscard">放弃</AppButton>
            </div>
          </div>
        </template>
      </template>

      <!-- 隐私说明：无论配没配好都显示 -->
      <p class="text-2xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
        改写时，只有你选中的这一段原文会发送给你配置的模型服务商，本地不额外保存副本。
        本站不保存你的 API Key，也不保存送去改写的内容；发送范围由你选的那一段决定。
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end">
        <AppButton size="sm" variant="secondary" @click="open = false">关闭</AppButton>
      </div>
    </template>
  </AppDrawer>
</template>