<script setup lang="ts">
import { computed, ref } from 'vue';
import { FileText, FileJson, FileType2, Printer, Download, Info } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppModal, AppButton, AppSelect, AppSwitch, FormField } from '../ui';
import { useToast } from '../../composables/useToast';
import { buildExportFilename } from '../../utils/exportFilename';
import { buildExportPayload, downloadText, serializeExport } from '../../utils/exportJson';
import { buildMarkdown } from '../../utils/exportMarkdown';
import { triggerPrintPdf } from '../../utils/exportPdf';
import { trackEvent } from '../../utils/telemetry';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const resumeStore = useResumeStore();
const toast = useToast();

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});

type Format = 'pdf' | 'docx' | 'json' | 'markdown';

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF（浏览器打印）' },
  { value: 'docx', label: 'Word 文档（.docx）' },
  { value: 'markdown', label: 'Markdown（.md）' },
  { value: 'json', label: 'JSON 备份（可回导）' }
];

const format = ref<Format>('pdf');
const busy = ref(false);

/** 打印专用选项 */
const printInkSaving = ref(false);
const printShowLinks = ref(true);

/**
 * 文件名去掉「简历」这类通用词后仍有信息量，才值得拼进去。
 * 三个字段全空时退回 store 里的标题。
 */
const baseFilename = computed(() =>
  buildExportFilename({
    name: resumeStore.content.profile.name,
    title: resumeStore.content.profile.title,
    workYears: resumeStore.content.profile.workYears,
    fallback: resumeStore.title,
    ext: 'pdf'
  }).replace(/\.pdf$/, '')
);

const isPdf = computed(() => format.value === 'pdf');
const isBackup = computed(() => format.value === 'json');

const formatHint = computed(() => {
  switch (format.value) {
    case 'pdf':
      return '将打开浏览器打印对话框，选择「另存为 PDF」。版式与编辑器预览一致。';
    case 'docx':
      return '生成 ATS 友好的单栏版式，不还原模板外观。适合需要上传 Word 文件的招聘系统。';
    case 'markdown':
      return '纯文本结构，方便粘贴到邮件、笔记或招聘网站的文本框。';
    case 'json':
      return '完整备份（含排版配置），可通过「导入」原样恢复。';
  }
});

function applyInkSaving(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.classList.add('print-ink-saving');
  else root.classList.remove('print-ink-saving');
}

function hideLinks(enabled: boolean) {
  // 只影响打印：模板里的外链渲染成纯文本
  const root = document.documentElement;
  if (enabled) root.classList.remove('print-hide-links');
  else root.classList.add('print-hide-links');
}

async function handleExport() {
  if (busy.value) return;
  busy.value = true;

  try {
    if (format.value === 'pdf') {
      applyInkSaving(printInkSaving.value);
      hideLinks(printShowLinks.value);
      try {
        // 打印必须留在点击的同步手势里；这里 await 的是资源等待，浏览器仍会接受
        await triggerPrintPdf(baseFilename.value);
      } finally {
        applyInkSaving(false);
        hideLinks(true);
      }
      toast.success('已打开打印对话框，选择「另存为 PDF」即可保存');
    } else if (format.value === 'docx') {
      const { exportDocx } = await import('../../utils/exportDocx');
      await exportDocx({
        title: resumeStore.title,
        content: resumeStore.content,
        filename: `${baseFilename.value}.docx`
      });
      toast.success('Word 文档已开始下载');
    } else if (format.value === 'markdown') {
      const markdown = buildMarkdown({
        title: resumeStore.title,
        content: resumeStore.content
      });
      downloadText(`${baseFilename.value}.md`, markdown, 'text/markdown');
      toast.success('Markdown 已开始下载');
    } else {
      const payload = buildExportPayload({
        title: resumeStore.title,
        templateId: resumeStore.templateId,
        themeConfig: resumeStore.themeConfig,
        content: resumeStore.content
      });
      downloadText(`${baseFilename.value}.json`, serializeExport(payload));
      toast.success('JSON 备份已开始下载');
    }

    // 只记格式，不记文件名/简历 id：导出失败率是按格式算的，不是按用户算的
    trackEvent(`export.${format.value}.ok`);
    emit('close');
  } catch (err) {
    console.error('导出失败:', err);
    trackEvent(`export.${format.value}.fail`);
    toast.error('导出失败，请重试或换一种格式');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal v-model:open="open" size="lg" title="导出简历">
    <div class="space-y-4">
      <FormField label="导出格式" id="export-format">
        <template #default="{ id }">
          <AppSelect :id="id" v-model="format" :options="FORMAT_OPTIONS" />
        </template>
      </FormField>

      <p class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <Info class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{{ formatHint }}</span>
      </p>

      <!-- 打印选项 -->
      <div v-if="isPdf" class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <AppSwitch
          v-model="printInkSaving"
          label="省墨模式"
          description="去掉背景色块与大面积色块，适合黑白打印"
        />
        <AppSwitch
          v-model="printShowLinks"
          label="保留链接文字"
          description="关闭后外链显示为纯文本，避免打印出一长串 URL"
        />
      </div>

      <div v-if="isBackup" class="p-3.5 rounded-xl bg-warning-50/60 border border-warning-100">
        <p class="text-2xs text-warning-700 leading-relaxed">
          JSON 备份包含头像等全部数据，文件可能较大。请妥善保管 —— 其中含有手机号与邮箱。
        </p>
      </div>

      <FormField label="文件名" id="export-filename" hint="下载时会自动追加扩展名">
        <template #default="{ id, describedBy }">
          <div class="flex items-center gap-2">
            <input
              :id="id"
              :value="baseFilename"
              readonly
              :aria-describedby="describedBy"
              class="flex-1 h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
            />
            <span class="text-2xs text-slate-500 font-mono shrink-0">
              .{{ format === 'markdown' ? 'md' : format === 'pdf' ? 'pdf' : format }}
            </span>
          </div>
        </template>
      </FormField>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div class="p-2 rounded-lg border border-slate-200 text-center">
          <Printer class="w-4 h-4 mx-auto text-slate-400" aria-hidden="true" />
          <p class="text-2xs text-slate-500 mt-1">PDF</p>
        </div>
        <div class="p-2 rounded-lg border border-slate-200 text-center">
          <FileType2 class="w-4 h-4 mx-auto text-slate-400" aria-hidden="true" />
          <p class="text-2xs text-slate-500 mt-1">Word</p>
        </div>
        <div class="p-2 rounded-lg border border-slate-200 text-center">
          <FileText class="w-4 h-4 mx-auto text-slate-400" aria-hidden="true" />
          <p class="text-2xs text-slate-500 mt-1">Markdown</p>
        </div>
        <div class="p-2 rounded-lg border border-slate-200 text-center">
          <FileJson class="w-4 h-4 mx-auto text-slate-400" aria-hidden="true" />
          <p class="text-2xs text-slate-500 mt-1">JSON</p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <AppButton variant="secondary" size="sm" @click="emit('close')">取消</AppButton>
        <AppButton size="sm" :loading="busy" @click="handleExport">
          <template #icon>
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>{{ isPdf ? '打开打印' : '下载文件' }}</span>
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>
