<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../stores/resume';
import { triggerPrintPdf } from '../utils/exportPdf';
import ClassicTemplate from '../templates/ClassicTemplate.vue';
import GeekTemplate from '../templates/GeekTemplate.vue';
import ModernTemplate from '../templates/ModernTemplate.vue';
import { Download, Sparkles } from 'lucide-vue-next';

const resumeStore = useResumeStore();

const currentTemplateComponent = computed(() => {
  switch (resumeStore.templateId) {
    case 'geek': return GeekTemplate;
    case 'modern': return ModernTemplate;
    case 'classic':
    default: return ClassicTemplate;
  }
});

const handlePrint = () => {
  triggerPrintPdf(resumeStore.title);
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col items-center">
    <!-- 顶部极简操作条 -->
    <header class="no-print w-full bg-white border-b border-slate-200 py-3 px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div class="flex items-center gap-2">
        <span class="font-extrabold text-sm text-blue-600">OpenResume</span>
        <span class="text-xs text-slate-400">· 简历在线预览</span>
      </div>

      <div class="flex items-center gap-3">
        <router-link to="/editor/demo" class="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1">
          <Sparkles class="w-3.5 h-3.5 text-blue-500" />
          <span>制作我的简历</span>
        </router-link>

        <button
          @click="handlePrint"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg transition"
        >
          <Download class="w-3.5 h-3.5" />
          <span>另存为 PDF</span>
        </button>
      </div>
    </header>

    <!-- A4 画布展示 -->
    <main class="py-8 flex justify-center w-full overflow-x-auto">
      <div class="a4-page a4-print-target bg-white shadow-xl rounded-sm" style="width: 210mm; min-height: 297mm;">
        <component
          :is="currentTemplateComponent"
          :content="resumeStore.content"
          :theme="resumeStore.themeConfig"
        />
      </div>
    </main>
  </div>
</template>
