<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowLeft, Check, FileText, Layers, Sparkles, Square } from 'lucide-vue-next';
import { AppButton, AppInput, AppModal, FormField } from '../ui';
import { TEMPLATES, findTemplate } from '../../constants/templates';
import type { ResumeLocale } from '../../../shared/types';

/**
 * 新建简历向导：模板 → 起点 → 命名 → 确认。
 *
 * 「起点」这一步解决的是真实困扰：同一份基础经历要投不同岗位时，
 * 每次都从空白开始重填一遍最费时间。允许直接复制已有简历作为起点，
 * 名字与模板都可以再改。
 */

/** 起点选项：空白 / 示例数据 / 复制已有 */
export type ResumeStart = 'blank' | 'sample' | 'copy';

export interface ResumeCopySource {
  id: string;
  title: string;
  templateId: string;
}

const props = defineProps<{
  open: boolean;
  /** 游客：选完模板直接进编辑器本地草稿，不需要命名 */
  guest?: boolean;
  creating?: boolean;
  /** 可复制的已有简历（游客无此列表） */
  existing?: ResumeCopySource[];
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (
    e: 'create',
    payload: {
      templateId: string;
      title: string;
      start: ResumeStart;
      copyFromId?: string;
      locale: ResumeLocale;
    }
  ): void;
  (e: 'guest-next', payload: { templateId: string; locale: ResumeLocale }): void;
}>();

const step = ref<1 | 2 | 3 | 4>(1);
const templateId = ref(TEMPLATES[0].id);
const start = ref<ResumeStart>('blank');
const copyFromId = ref<string>('');
const title = ref('未命名求职简历');
const titleTouched = ref(false);
/** 简历语言：决定示例数据与空骨架的模块标题 */
const locale = ref<ResumeLocale>('zh-CN');

const LOCALE_OPTIONS: Array<{ value: ResumeLocale; label: string; hint: string }> = [
  { value: 'zh-CN', label: '中文', hint: '投国内岗位' },
  { value: 'en', label: 'English', hint: '投外企 / 海外岗位' }
];

const selected = computed(() => findTemplate(templateId.value));
const copyCandidates = computed(() => props.existing ?? []);
const canCopy = computed(() => copyCandidates.value.length > 0);

const titleError = computed(() => {
  if (!titleTouched.value) return undefined;
  const value = title.value.trim();
  if (!value) return '请填写简历名称';
  if (value.length > 100) return '名称不能超过 100 个字符';
  return undefined;
});

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

const START_OPTIONS = computed(() => [
  {
    key: 'blank' as ResumeStart,
    icon: Square,
    title: '空白简历',
    desc: '从零开始填写，适合第一次使用',
    disabled: false
  },
  {
    key: 'sample' as ResumeStart,
    icon: FileText,
    title: '示例数据',
    desc: '带一份范文，便于先看排版效果再替换',
    disabled: false
  },
  {
    key: 'copy' as ResumeStart,
    icon: Layers,
    title: '复制已有简历',
    desc: canCopy.value ? '基于已有内容改一版，投不同岗位' : '还没有可复制的简历',
    disabled: !canCopy.value
  }
]);

function reset() {
  step.value = 1;
  templateId.value = TEMPLATES[0].id;
  start.value = 'blank';
  copyFromId.value = copyCandidates.value[0]?.id ?? '';
  title.value = '未命名求职简历';
  titleTouched.value = false;
  locale.value = 'zh-CN';
}

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  }
);

/** 选「复制已有简历」时，默认把源简历的名字带过来，省一次输入 */
watch(start, (value) => {
  if (value !== 'copy') return;
  const source = copyCandidates.value.find((item) => item.id === copyFromId.value);
  if (source) {
    // 源简历的 templateId 是 string（服务端数据），这里收窄回 TemplateId
    templateId.value = findTemplate(source.templateId).id;
    title.value = `${source.title} - 副本`;
  }
});

watch(copyFromId, (id) => {
  if (start.value !== 'copy') return;
  const source = copyCandidates.value.find((item) => item.id === id);
  if (!source) return;
  templateId.value = findTemplate(source.templateId).id;
  title.value = `${source.title} - 副本`;
});

function next() {
  if (step.value === 1) {
    if (props.guest) {
      emit('guest-next', { templateId: templateId.value, locale: locale.value });
      emit('update:open', false);
      return;
    }
    step.value = 2;
    return;
  }
  if (step.value === 2) {
    // 选了复制却没选源简历，不能进入下一步
    if (start.value === 'copy' && !copyFromId.value) return;
    step.value = 3;
    return;
  }
  if (step.value === 3) {
    titleTouched.value = true;
    if (titleError.value || !title.value.trim()) return;
    step.value = 4;
  }
}

function submit() {
  if (props.guest) {
    emit('guest-next', { templateId: templateId.value, locale: locale.value });
    return;
  }
  titleTouched.value = true;
  if (titleError.value || !title.value.trim()) {
    step.value = 3;
    return;
  }
  emit('create', {
    templateId: templateId.value,
    title: title.value.trim(),
    start: start.value,
    copyFromId: start.value === 'copy' ? copyFromId.value : undefined,
    locale: locale.value
  });
}

const startLabel = computed(() => START_OPTIONS.value.find((item) => item.key === start.value)?.title ?? '');
const stepLabel = computed(() => (props.guest ? '选择模板' : `第 ${step.value} / 4 步`));
</script>

<template>
  <AppModal
    v-model:open="openModel"
    size="lg"
    :title="guest ? '选择模板开始制作' : '新建一份简历'"
    :close-on-overlay="!creating"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-2xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          {{ stepLabel }}
        </span>
        <h2 class="text-sm font-bold text-slate-900">
          {{ guest ? '选择模板开始制作' : '新建一份简历' }}
        </h2>
      </div>
      <p class="text-2xs text-slate-500 mt-1">
        {{ guest ? '无需注册即可编辑，登录后可保存到云端' : '模板随时可切换，不会丢失已填写的内容' }}
      </p>
    </template>

    <!-- 第 1 步：模板 -->
    <div v-if="step === 1" class="space-y-2.5">
      <button
        v-for="tpl in TEMPLATES"
        :key="tpl.id"
        type="button"
        class="w-full text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3.5"
        :class="
          templateId === tpl.id
            ? 'border-primary-500 bg-primary-50/40'
            : 'border-slate-200 bg-white hover:border-slate-300'
        "
        :aria-pressed="templateId === tpl.id"
        @click="templateId = tpl.id"
      >
        <div
          class="w-10 h-14 rounded border border-slate-300 flex-shrink-0 flex flex-col p-1 gap-1 shadow-xs"
          :class="tpl.accent"
          aria-hidden="true"
        >
          <div class="h-1.5 bg-slate-400/60 rounded-sm w-3/4 mx-auto" />
          <div class="h-1 bg-slate-300/60 rounded-sm w-full" />
          <div class="h-1 bg-slate-300/60 rounded-sm w-5/6" />
          <div class="h-1 bg-slate-300/60 rounded-sm w-4/5" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-slate-900">{{ tpl.name }}</h3>
            <span class="text-2xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {{ tpl.tag }}
            </span>
          </div>
          <p class="text-2xs text-slate-500 mt-1 leading-relaxed">{{ tpl.description }}</p>
        </div>

        <span
          class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          :class="templateId === tpl.id ? 'bg-primary-500 text-white' : 'border border-slate-300 text-transparent'"
          aria-hidden="true"
        >
          <Check class="w-3 h-3" />
        </span>
      </button>
    </div>

    <!-- 第 2 步：起点 -->
    <div v-else-if="step === 2" class="space-y-2.5">
      <button
        v-for="option in START_OPTIONS"
        :key="option.key"
        type="button"
        class="w-full text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3"
        :class="[
          start === option.key ? 'border-primary-500 bg-primary-50/40' : 'border-slate-200 bg-white hover:border-slate-300',
          option.disabled && 'opacity-50 cursor-not-allowed hover:border-slate-200'
        ]"
        :disabled="option.disabled"
        :aria-pressed="start === option.key"
        @click="!option.disabled && (start = option.key)"
      >
        <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
          <component :is="option.icon" class="w-4 h-4" aria-hidden="true" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-slate-900">{{ option.title }}</div>
          <p class="text-2xs text-slate-500 mt-1 leading-relaxed">{{ option.desc }}</p>
        </div>
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          :class="start === option.key ? 'bg-primary-500 text-white' : 'border border-slate-300 text-transparent'"
          aria-hidden="true"
        >
          <Check class="w-3 h-3" />
        </span>
      </button>

      <!-- 简历语言：复制已有简历时语言由源简历决定，不需要再选 -->
      <div v-if="start !== 'copy'">
        <label class="block text-2xs font-medium text-slate-500 mb-1">简历语言</label>
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="简历语言">
          <button
            v-for="option in LOCALE_OPTIONS"
            :key="option.value"
            type="button"
            class="px-2.5 py-1.5 rounded-lg border text-left transition"
            :class="
              locale === option.value
                ? 'border-primary-500 bg-primary-50/60 text-primary-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            "
            :aria-pressed="locale === option.value"
            @click="locale = option.value"
          >
            <span class="block text-xs font-bold">{{ option.label }}</span>
            <span class="block text-2xs text-slate-500 mt-0.5">{{ option.hint }}</span>
          </button>
        </div>
        <p class="text-2xs text-slate-500 mt-1.5">
          决定模块标题与日期格式（如「工作经历」或「Work Experience」）；随时可在排版设置里改
        </p>
      </div>

      <!-- 复制源选择 -->
      <FormField
        v-if="start === 'copy'"
        label="从哪一份复制"
        id="create-copy-source"
        hint="复制的是内容与排版配置，之后两边互不影响"
      >
        <template #default="{ id }">
          <select
            :id="id"
            v-model="copyFromId"
            class="w-full h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option v-for="item in copyCandidates" :key="item.id" :value="item.id">
              {{ item.title }}
            </option>
          </select>
        </template>
      </FormField>
    </div>

    <!-- 第 3 步：命名 -->
    <div v-else-if="step === 3" class="space-y-4">
      <FormField
        label="简历名称"
        id="create-resume-title"
        required
        hint="建议写成「岗位 + 姓名」，方便在列表中区分不同投递版本"
        :error="titleError"
      >
        <template #default="{ id, describedBy, invalid }">
          <AppInput
            :id="id"
            v-model="title"
            placeholder="如：前端工程师-张小凡"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @blur="titleTouched = true"
            @keydown.enter.prevent="next"
          />
        </template>
      </FormField>

      <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-2xs text-slate-500 leading-relaxed">
        将使用
        <span class="font-semibold text-slate-700">{{ selected.shortName }}</span>
        模板。之后可以随时在编辑器右上角切换模板，内容不会丢失。
      </div>
    </div>

    <!-- 第 4 步：确认 -->
    <div v-else class="space-y-3">
      <div class="p-4 rounded-xl border border-slate-200 bg-white">
        <div class="text-2xs text-slate-500">即将创建</div>
        <div class="text-sm font-bold text-slate-900 mt-1 truncate">{{ title.trim() }}</div>
        <div class="flex flex-wrap items-center gap-2 mt-2 text-2xs text-slate-500">
          <span class="font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {{ selected.shortName }}
          </span>
          <span class="font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {{ startLabel }}
          </span>
          <span>· 默认不公开，分享链接需手动开启</span>
        </div>
      </div>
      <p class="text-2xs text-slate-500 leading-relaxed">
        创建后会自动保存，并打开编辑器。你可以先填写内容，随时导出 PDF。
      </p>
    </div>

    <template #footer>
      <AppButton
        v-if="step > 1"
        variant="ghost"
        :disabled="creating"
        @click="step = (step - 1) as 1 | 2 | 3"
      >
        <template #icon>
          <ArrowLeft class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>上一步</span>
      </AppButton>
      <AppButton variant="ghost" :disabled="creating" @click="emit('update:open', false)">
        取消
      </AppButton>
      <AppButton
        v-if="step < 4 || guest"
        :loading="creating"
        @click="next"
      >
        <template #icon>
          <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>{{ guest ? '开始制作' : '下一步' }}</span>
      </AppButton>
      <AppButton v-else :loading="creating" @click="submit">
        <template #icon>
          <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>创建并编辑</span>
      </AppButton>
    </template>
  </AppModal>
</template>
