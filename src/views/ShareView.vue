<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { triggerPrintPdf } from '../utils/exportPdf';
import { apiFetch } from '../utils/http';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import ClassicTemplate from '../templates/ClassicTemplate.vue';
import GeekTemplate from '../templates/GeekTemplate.vue';
import ModernTemplate from '../templates/ModernTemplate.vue';
import { Download, Sparkles, Loader2, AlertCircle } from 'lucide-vue-next';
import { AppButton } from '../components/ui';

const route = useRoute();
const resumeId = route.params.id as string;

const loading = ref(true);
const notFound = ref(false);
const isExporting = ref(false);
const title = ref('个人简历');
const templateId = ref('classic');
const content = ref<ResumeContent>(JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)));
const themeConfig = ref<ThemeConfig>(JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)));

// 访客阅读足迹统计 (HR Read Analytics)
const startTime = ref(Date.now());
let hasReported = false;

const reportVisit = (isDownloaded = false) => {
  if (!resumeId || resumeId === 'demo') return;
  const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 1000));
  const payload = JSON.stringify({ duration, isDownloaded });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(`/api/share/${resumeId}/visit`, blob);
  } else {
    fetch(`/api/share/${resumeId}/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
};

const handlePrint = async () => {
  if (isExporting.value) return;
  isExporting.value = true;
  reportVisit(true);
  try {
    await triggerPrintPdf(title.value);
  } finally {
    isExporting.value = false;
  }
};

const currentTemplateComponent = computed(() => {
  switch (templateId.value) {
    case 'geek': return GeekTemplate;
    case 'modern': return ModernTemplate;
    case 'classic':
    default: return ClassicTemplate;
  }
});

const errorMsg = ref('该在线简历不存在或已关闭分享');

onMounted(async () => {
  // 1. 若非 demo 则请求云端公开接口
  if (resumeId && resumeId !== 'demo' && resumeId !== 'local-draft') {
    try {
      const result = await apiFetch<any>(`/api/share/${resumeId}`, { auth: false });
      if (!result.ok) {
        notFound.value = true;
        if (result.status === 403 || result.code === 40301) {
          errorMsg.value = '该简历暂未开启公开分享，请联系求职者开启后查阅';
        } else {
          errorMsg.value = '该在线简历不存在或已失效';
        }
      } else if (result.data) {
        title.value = result.data.title || '个人简历';
        templateId.value = result.data.templateId || 'classic';
        content.value = result.data.content || content.value;
        themeConfig.value = result.data.themeConfig || themeConfig.value;
      } else {
        notFound.value = true;
      }
    } finally {
      loading.value = false;
    }
  } else {
    loading.value = false;
  }

  // 监听页面离开事件上报足迹
  window.addEventListener('beforeunload', () => {
    if (!hasReported) {
      reportVisit(false);
      hasReported = true;
    }
  });
});

onUnmounted(() => {
  if (!hasReported) {
    reportVisit(false);
    hasReported = true;
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col items-center">
    <!-- 顶部极简操作条 -->
    <header class="no-print w-full bg-white border-b border-slate-200 py-3 px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div class="flex items-center gap-2">
        <span class="font-extrabold text-sm text-primary-600">OpenResume</span>
        <span class="text-xs text-slate-500">· 在线高清阅览</span>
      </div>

      <div class="flex items-center gap-3">
        <router-link to="/editor/new" class="text-xs font-semibold text-slate-600 hover:text-primary-600 flex items-center gap-1">
          <Sparkles class="w-3.5 h-3.5 text-primary-500" />
          <span>制作我的同款简历</span>
        </router-link>

        <AppButton
          size="sm"
          :loading="isExporting"
          :disabled="loading || notFound"
          @click="handlePrint"
        >
          <template #icon>
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>{{ isExporting ? '准备中...' : '另存为 PDF' }}</span>
        </AppButton>
      </div>
    </header>

    <!-- 加载中指示 -->
    <div v-if="loading" class="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
      <Loader2 class="w-8 h-8 animate-spin text-primary-600" />
      <span class="text-xs">正在以毫秒级自适应排版加载简历...</span>
    </div>

    <!-- 简历不存在提示 -->
    <div v-else-if="notFound" class="py-24 text-center max-w-sm px-4">
      <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
        <AlertCircle class="w-6 h-6" />
      </div>
      <h3 class="text-base font-bold text-slate-800">{{ errorMsg }}</h3>
      <p class="text-xs text-slate-400 mt-1">求职者可能已更新链接或更改了该在线版本的分享权限。</p>
      <div class="mt-5">
        <router-link to="/" class="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
          <span>返回 OpenResume 首页</span>
        </router-link>
      </div>
    </div>

    <!-- 真实标准 A4 画布展示 -->
    <main v-else id="main-content" tabindex="-1" class="share-main-area py-8 flex justify-center w-full overflow-x-auto">
      <div class="a4-page a4-print-target bg-white shadow-xl rounded-sm" style="width: 210mm; min-height: 297mm;">
        <component
          :is="currentTemplateComponent"
          :content="content"
          :theme="themeConfig"
        />
      </div>
    </main>
  </div>
</template>
