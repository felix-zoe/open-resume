<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileUp, ClipboardPaste, FileJson, FileText, AlertTriangle } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppModal, AppButton, AppTextarea, AppTabs, FormField } from '../ui';
import { useToast } from '../../composables/useToast';
import { parseImportPayload } from '../../utils/exportJson';
import { parseMarkdown, parsePlainText } from '../../utils/importText';
import { DEFAULT_RESUME_CONTENT } from '../../utils/presets';
import type { ResumeContent } from '../../types/resume';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'imported'): void }>();

const resumeStore = useResumeStore();
const toast = useToast();

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});

type Mode = 'json' | 'text' | 'markdown';

const mode = ref<Mode>('json');
const TABS = [
  { key: 'json', label: 'JSON 备份' },
  { key: 'text', label: '粘贴文本' },
  { key: 'markdown', label: 'Markdown' }
];

const rawInput = ref('');
const error = ref('');
const preview = ref<{
  title: string;
  templateId: string;
  content: ResumeContent;
  summary: string;
} | null>(null);

const fileInputRef = ref<HTMLInputElement | null>(null);

function reset() {
  rawInput.value = '';
  error.value = '';
  preview.value = null;
}

function onModeChange(next: string) {
  mode.value = next as Mode;
  reset();
}

function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    error.value = '文件超过 2MB，请确认导出的是简历文件而不是其他内容';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    rawInput.value = String(reader.result || '');
    if (file.name.endsWith('.md')) mode.value = 'markdown';
    else if (file.name.endsWith('.json')) mode.value = 'json';
    else mode.value = 'text';
    parse();
  };
  reader.onerror = () => {
    error.value = '文件读取失败，请重试';
  };
  reader.readAsText(file);
}

/**
 * 解析但不落库：先给用户看「识别到什么」，确认后再写入。
 *
 * 文本/Markdown 的解析是启发式的，直接覆盖用户当前简历风险太大 ——
 * 一份排版精美的简历被解析成半截，是不可接受的损失。
 */
function parse() {
  error.value = '';
  preview.value = null;

  const raw = rawInput.value.trim();
  if (!raw) {
    error.value = '请先粘贴内容或选择文件';
    return;
  }

  if (mode.value === 'json') {
    const result = parseImportPayload(raw);
    if (!result.ok) {
      error.value = result.error;
      return;
    }
    preview.value = {
      title: result.payload.title,
      templateId: result.payload.templateId,
      content: result.payload.content,
      summary: `完整备份 · 模板 ${result.payload.templateId} · 导出于 ${new Date(result.payload.exportedAt).toLocaleDateString('zh-CN')}`
    };
    return;
  }

  const defaults: ResumeContent = JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT));
  const result =
    mode.value === 'markdown' ? parseMarkdown(raw, defaults) : parsePlainText(raw, defaults);

  if (result.sectionCount === 0) {
    error.value = '没有识别到任何章节标题（如「工作经历」「教育背景」），请检查格式或改用 JSON 备份';
    return;
  }

  const counts = [
    result.content.modules.work.items.length && `工作 ${result.content.modules.work.items.length} 条`,
    result.content.modules.projects.items.length && `项目 ${result.content.modules.projects.items.length} 条`,
    result.content.modules.education.items.length && `教育 ${result.content.modules.education.items.length} 条`,
    result.content.modules.skills.items.length && `技能 ${result.content.modules.skills.items.length} 项`
  ].filter(Boolean);

  preview.value = {
    title: result.content.profile.name ? `${result.content.profile.name}的简历` : '导入的简历',
    templateId: resumeStore.templateId,
    content: result.content,
    summary: `识别到 ${result.sectionCount} 个章节${counts.length ? ` · ${counts.join('、')}` : ''}${
      result.unparsedLines ? ` · ${result.unparsedLines} 行未能归类` : ''
    }`
  };
}

function confirmImport() {
  if (!preview.value) return;

  resumeStore.loadResumeData({
    id: resumeStore.id,
    title: preview.value.title,
    templateId: preview.value.templateId,
    content: preview.value.content
  });

  toast.success('已导入，请检查各模块内容是否完整');
  emit('imported');
  emit('close');
  reset();
}
</script>

<template>
  <AppModal v-model:open="open" size="lg" title="导入简历">
    <div class="space-y-4">
      <AppTabs :model-value="mode" :tabs="TABS" aria-label="导入来源" @update:model-value="onModeChange" />

      <p v-if="mode === 'json'" class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <FileJson class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>导入本产品导出的 JSON 备份，内容与排版配置都会原样恢复。</span>
      </p>
      <p v-else class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <FileText class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          按「工作经历 / 项目经历 / 教育背景 / 专业技能」等标题分段。识别结果先预览，
          确认后才写入当前简历；识别不全的部分需要手动补齐。
        </span>
      </p>

      <div class="flex items-center gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,.md,.markdown,.txt"
          class="sr-only"
          @change="handleFile"
        />
        <AppButton variant="secondary" size="sm" @click="fileInputRef?.click()">
          <template #icon>
            <FileUp class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>选择文件</span>
        </AppButton>
        <span class="text-2xs text-slate-500">支持 .json / .md / .txt，≤ 2MB</span>
      </div>

      <FormField
        :label="mode === 'json' ? 'JSON 内容' : '简历文本'"
        id="import-input"
        :error="error"
        hint="也可以直接粘贴内容"
      >
        <template #default="{ id, describedBy, invalid }">
          <AppTextarea
            :id="id"
            v-model="rawInput"
            :rows="8"
            :invalid="invalid"
            :aria-describedby="describedBy"
            :placeholder="
              mode === 'json'
                ? '{ &quot;schema&quot;: &quot;openresume/resume&quot;, ... }'
                : '张三\n前端工程师 · 5 年经验\n13800138000 · zhang@example.com\n\n工作经历\n2021.01 - 至今  某公司 · 前端工程师\n- 主导性能优化，首屏耗时降低 40%'
            "
            @blur="rawInput.trim() && parse()"
          />
        </template>
      </FormField>

      <div class="flex items-center justify-end gap-2">
        <AppButton variant="ghost" size="sm" :disabled="!rawInput.trim()" @click="parse">
          <template #icon>
            <ClipboardPaste class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>预览识别结果</span>
        </AppButton>
      </div>

      <div v-if="preview" class="p-3.5 rounded-xl bg-success-50/60 border border-success-100 space-y-2">
        <p class="text-xs font-bold text-success-700">{{ preview.title }}</p>
        <p class="text-2xs text-slate-600 leading-relaxed">{{ preview.summary }}</p>
        <p class="text-2xs text-slate-500 leading-relaxed">
          姓名：{{ preview.content.profile.name || '（未识别）' }} ·
          电话：{{ preview.content.profile.phone || '（未识别）' }} ·
          邮箱：{{ preview.content.profile.email || '（未识别）' }}
        </p>
      </div>

      <p v-if="preview" class="text-2xs text-warning-700 flex items-start gap-1.5 leading-relaxed">
        <AlertTriangle class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>导入会覆盖当前简历内容。如有需要，请先在「版本历史」里保存一份快照。</span>
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <AppButton variant="secondary" size="sm" @click="emit('close')">取消</AppButton>
        <AppButton size="sm" :disabled="!preview" @click="confirmImport">确认导入</AppButton>
      </div>
    </template>
  </AppModal>
</template>
