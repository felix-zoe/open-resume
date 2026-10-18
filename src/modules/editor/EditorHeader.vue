<script setup lang="ts">
import { ref } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { useAuthStore } from '../../stores/auth';
import { triggerPrintPdf } from '../../utils/exportPdf';
import AuthModal from '../../components/AuthModal.vue';
import { AppButton, AppMenu, BrandMark } from '../../components/ui';
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
  Target,
  MoreHorizontal
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'toggleStyleDrawer'): void;
  (e: 'toggleTemplateModal'): void;
  (e: 'toggleAtsModal'): void;
}>();

const resumeStore = useResumeStore();
const authStore = useAuthStore();
const isEditingTitle = ref(false);
const isAuthModalOpen = ref(false);
const isPrinting = ref(false);
const autoFitToast = ref<string | null>(null);
/** 小屏下把次要操作收进「更多」菜单 */
const isMoreMenuOpen = ref(false);

function runFromMenu(action: () => void) {
  isMoreMenuOpen.value = false;
  action();
}

const handleAutoFit = () => {
  const res = resumeStore.autoFitOnePage();
  autoFitToast.value = res.message;
  setTimeout(() => {
    autoFitToast.value = null;
  }, 3500);
};

/** demo 与本地草稿只存在于当前浏览器，生成分享链接会让 HR 看到示例数据 */
const isShareable = () =>
  !!authStore.isLoggedIn &&
  !resumeStore.id.startsWith('local_') &&
  resumeStore.id !== 'local-draft' &&
  resumeStore.id !== 'demo';

const handleShare = async () => {
  if (!isShareable()) {
    isAuthModalOpen.value = !authStore.isLoggedIn;
    autoFitToast.value = authStore.isLoggedIn
      ? '当前简历还未保存到云端，请先在「我的简历」中新建一份云端简历'
      : '分享前需要先登录并保存到云端，示例草稿不会生成分享链接';
    setTimeout(() => {
      autoFitToast.value = null;
    }, 5000);
    return;
  }

  const shareUrl = `${window.location.origin}/share/${resumeStore.id}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    autoFitToast.value = `分享链接已复制：${shareUrl}`;
  } catch {
    autoFitToast.value = `分享链接：${shareUrl}`;
  }
  setTimeout(() => {
    autoFitToast.value = null;
  }, 5000);
};

const handleExport = async () => {
  if (isPrinting.value) return;
  isPrinting.value = true;
  try {
    await triggerPrintPdf(resumeStore.title);
    autoFitToast.value = '已打开打印对话框，选择「另存为 PDF」即可保存';
  } catch (err) {
    console.error(err);
    autoFitToast.value = '打印对话框未能打开，请检查浏览器权限';
  } finally {
    isPrinting.value = false;
    setTimeout(() => {
      autoFitToast.value = null;
    }, 4000);
  }
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
  <header class="no-print h-14 bg-white border-b border-slate-200 px-2 sm:px-4 flex items-center justify-between gap-2 shadow-xs z-20 sticky top-0">
    <!-- 左侧：返回、标题与状态 -->
    <div class="flex items-center gap-2 sm:gap-3 min-w-0">
      <router-link to="/" class="flex items-center gap-1.5 font-bold text-primary-600 hover:opacity-80 transition text-sm">
        <BrandMark size="sm" />
        <span class="hidden sm:inline">OpenResume</span>
      </router-link>

      <span class="text-slate-300">|</span>

      <!-- 简历标题即时修改 -->
      <div class="flex items-center gap-1.5">
        <input
          v-if="isEditingTitle"
          v-model="resumeStore.title"
          @blur="isEditingTitle = false"
          @keyup.enter="isEditingTitle = false"
          class="text-xs sm:text-sm font-semibold text-slate-800 border-b border-primary-500 bg-primary-50/50 px-1 py-0.5 outline-none focus:ring-0"
          auto-focus
        />
        <h2
          v-else
          @click="isEditingTitle = true"
          title="点击重命名"
          class="text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition max-w-[130px] sm:max-w-xs truncate"
        >
          {{ resumeStore.title }}
        </h2>

        <!-- 保存状态指示 -->
        <div class="hidden md:flex items-center gap-1 text-2xs text-slate-500 ml-2">
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
    <div class="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs text-slate-600">
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
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <!-- 未登录时的同步云端引导 -->
      <button
        v-if="!authStore.isLoggedIn"
        @click="isAuthModalOpen = true"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <CloudUpload class="w-3.5 h-3.5" />
        <span>同步云端</span>
      </button>

      <button
        @click="$emit('toggleTemplateModal')"
        class="hidden md:inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <LayoutTemplate class="w-3.5 h-3.5 text-slate-500" />
        <span class="hidden sm:inline">切换模板</span>
      </button>

      <!-- 智能一键卡页神器 -->
      <button
        @click="handleAutoFit"
        title="算法自动解算最佳间距与字号，完美将内容收敛至单页 A4"
        class="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs group"
      >
        <Sparkles class="w-3.5 h-3.5 text-primary-600 group-hover:rotate-12 transition transform" />
        <span>一键单页</span>
      </button>

      <!-- 目标岗位 JD 诊断 -->
      <button
        @click="$emit('toggleAtsModal')"
        title="根据招聘要求诊断关键词命中率与 ATS 评分"
        class="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs group cursor-pointer"
      >
        <Target class="w-3.5 h-3.5 text-primary-600 group-hover:scale-110 transition transform" />
        <span class="hidden sm:inline">岗位诊断</span>
      </button>

      <button
        @click="$emit('toggleStyleDrawer')"
        class="hidden md:inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <Palette class="w-3.5 h-3.5 text-slate-500" />
        <span>排版设置</span>
      </button>

      <button
        @click="handleShare"
        title="生成在线只读分享链接"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <Share2 class="w-3.5 h-3.5 text-slate-500" />
        <span>分享</span>
      </button>

      <button
        @click="resumeStore.resetToPreset"
        title="重置为默认演示数据"
        class="hidden md:inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>范文</span>
      </button>

      <!-- 小屏：次要操作收进「更多」菜单 -->
      <AppMenu
        :open="isMoreMenuOpen"
        class="md:hidden"
        aria-label="更多操作"
        @update:open="isMoreMenuOpen = $event"
      >
        <template #trigger="{ open }">
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            aria-label="更多操作"
            :aria-expanded="open"
            @click="isMoreMenuOpen = !isMoreMenuOpen"
          >
            <MoreHorizontal class="w-4 h-4" />
          </button>
        </template>

        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(() => emit('toggleTemplateModal'))"
        >
          <LayoutTemplate class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>切换模板</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(handleAutoFit)"
        >
          <Sparkles class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>一键单页</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(() => emit('toggleAtsModal'))"
        >
          <Target class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>岗位诊断</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(() => emit('toggleStyleDrawer'))"
        >
          <Palette class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>排版设置</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(handleShare)"
        >
          <Share2 class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>分享</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(resumeStore.resetToPreset)"
        >
          <RotateCcw class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>重置为范文</span>
        </button>
      </AppMenu>

      <!-- 核心导出 PDF 按钮 -->
      <AppButton size="sm" :loading="isPrinting" aria-label="导出 PDF" @click="handleExport">
        <template #icon>
          <Download class="w-4 h-4" aria-hidden="true" />
        </template>
        <span class="hidden sm:inline">{{ isPrinting ? '准备中...' : '导出 PDF' }}</span>
      </AppButton>
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
