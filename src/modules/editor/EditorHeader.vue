<script setup lang="ts">
import { ref } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { useAuthStore } from '../../stores/auth';
import { triggerPrintPdf } from '../../utils/exportPdf';
import AuthModal from '../../components/AuthModal.vue';
import {
  Download,
  Palette,
  LayoutTemplate,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  CloudUpload,
  Sparkles,
  Target
} from 'lucide-vue-next';

defineEmits<{
  (e: 'toggleStyleDrawer'): void;
  (e: 'toggleTemplateModal'): void;
  (e: 'toggleAtsModal'): void;
}>();

const resumeStore = useResumeStore();
const authStore = useAuthStore();
const isEditingTitle = ref(false);
const isAuthModalOpen = ref(false);
const autoFitToast = ref<string | null>(null);

const handleAutoFit = () => {
  const res = resumeStore.autoFitOnePage();
  autoFitToast.value = res.message;
  setTimeout(() => {
    autoFitToast.value = null;
  }, 3500);
};

const handleShare = () => {
  const shareUrl = `${window.location.origin}/share/${resumeStore.id}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(`在线分享链接已复制到剪贴板！\n${shareUrl}`);
  }).catch(() => {
    alert(`分享链接：${shareUrl}`);
  });
};

const handleExport = () => {
  triggerPrintPdf(resumeStore.title);
};

const handleZoomIn = () => {
  if (resumeStore.zoom < 1.5) resumeStore.zoom = Number((resumeStore.zoom + 0.1).toFixed(1));
};

const handleZoomOut = () => {
  if (resumeStore.zoom > 0.5) resumeStore.zoom = Number((resumeStore.zoom - 0.1).toFixed(1));
};

const handleZoomReset = () => {
  resumeStore.zoom = 1;
};
</script>

<template>
  <header class="no-print h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shadow-xs z-20 sticky top-0">
    <!-- 左侧：返回、标题与状态 -->
    <div class="flex items-center gap-3">
      <router-link to="/" class="flex items-center gap-1.5 font-bold text-blue-600 hover:opacity-80 transition text-sm">
        <span class="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">R</span>
        <span class="hidden sm:inline">OpenResume</span>
      </router-link>

      <span class="text-gray-300">|</span>

      <!-- 简历标题即时修改 -->
      <div class="flex items-center gap-1.5">
        <input
          v-if="isEditingTitle"
          v-model="resumeStore.title"
          @blur="isEditingTitle = false"
          @keyup.enter="isEditingTitle = false"
          class="text-xs sm:text-sm font-semibold text-gray-800 border-b border-blue-500 bg-blue-50/50 px-1 py-0.5 outline-none focus:ring-0"
          auto-focus
        />
        <h2
          v-else
          @click="isEditingTitle = true"
          title="点击重命名"
          class="text-xs sm:text-sm font-semibold text-gray-800 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition max-w-[180px] sm:max-w-xs truncate"
        >
          {{ resumeStore.title }} ✏️
        </h2>

        <!-- 保存状态指示 -->
        <div class="hidden md:flex items-center gap-1 text-[11px] text-gray-400 ml-2">
          <template v-if="resumeStore.saveStatus === 'saved'">
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
            <span>已保存 {{ resumeStore.lastSavedTime }}</span>
          </template>
          <template v-else-if="resumeStore.saveStatus === 'saving'">
            <Clock class="w-3.5 h-3.5 text-amber-500 animate-spin" />
            <span>保存中...</span>
          </template>
          <template v-else-if="resumeStore.saveStatus === 'unsaved'">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>有未保存改动</span>
          </template>
          <template v-else>
            <AlertCircle class="w-3.5 h-3.5 text-rose-500" />
            <span>保存失败</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 中间：画布缩放控制 -->
    <div class="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs text-gray-600">
      <button @click="handleZoomOut" class="p-1 hover:bg-white rounded transition" title="缩小">
        <ZoomOut class="w-3.5 h-3.5" />
      </button>
      <span class="px-1.5 font-mono font-medium">{{ Math.round(resumeStore.zoom * 100) }}%</span>
      <button @click="handleZoomIn" class="p-1 hover:bg-white rounded transition" title="放大">
        <ZoomIn class="w-3.5 h-3.5" />
      </button>
      <button @click="handleZoomReset" class="p-1 hover:bg-white rounded transition ml-1" title="恢复 100%">
        <Maximize2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- 右侧：模板、样式、重置、分享、导出 -->
    <div class="flex items-center gap-2">
      <!-- 未登录时的同步云端引导 -->
      <button
        v-if="!authStore.isLoggedIn"
        @click="isAuthModalOpen = true"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <CloudUpload class="w-3.5 h-3.5" />
        <span>同步云端</span>
      </button>

      <button
        @click="$emit('toggleTemplateModal')"
        class="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <LayoutTemplate class="w-3.5 h-3.5 text-gray-500" />
        <span class="hidden sm:inline">切换模板</span>
      </button>

      <!-- 智能一键卡页神器 -->
      <button
        @click="handleAutoFit"
        title="算法自动解算最佳间距与字号，完美将内容收敛至单页 A4"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs group"
      >
        <Sparkles class="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition transform" />
        <span>一键单页</span>
      </button>

      <!-- 目标岗位 JD 诊断 -->
      <button
        @click="$emit('toggleAtsModal')"
        title="根据招聘要求诊断关键词命中率与 ATS 评分"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs group cursor-pointer"
      >
        <Target class="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition transform" />
        <span class="hidden sm:inline">岗位诊断</span>
      </button>

      <button
        @click="$emit('toggleStyleDrawer')"
        class="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <Palette class="w-3.5 h-3.5 text-gray-500" />
        <span>排版设置</span>
      </button>

      <button
        @click="handleShare"
        title="生成在线只读分享链接"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <Share2 class="w-3.5 h-3.5 text-gray-500" />
        <span>分享</span>
      </button>

      <button
        @click="resumeStore.resetToPreset"
        title="重置为默认演示数据"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>范文</span>
      </button>

      <!-- 核心导出 PDF 按钮 -->
      <button
        @click="handleExport"
        class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow transition"
      >
        <Download class="w-4 h-4" />
        <span>导出 PDF</span>
      </button>
    </div>

    <!-- 登录/注册弹窗 -->
    <AuthModal
      :isOpen="isAuthModalOpen"
      @close="isAuthModalOpen = false"
      @success="resumeStore.saveResume"
    />

    <!-- 智能卡页 Toast 提示浮层 -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="autoFitToast"
        class="fixed top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-4 py-2 rounded-xl shadow-xl text-xs font-medium z-50 flex items-center gap-2 backdrop-blur-sm border border-slate-700/50"
      >
        <Sparkles class="w-4 h-4 text-amber-400" />
        <span>{{ autoFitToast }}</span>
      </div>
    </transition>
  </header>
</template>
