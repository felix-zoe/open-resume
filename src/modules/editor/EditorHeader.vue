<script setup lang="ts">
import { ref } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { useAuthStore } from '../../stores/auth';
import { checkResumeContent } from '../../utils/validation';
import AuthModal from '../../components/AuthModal.vue';
import ShareDialog from '../../components/share/ShareDialog.vue';
import VersionDrawer from '../../components/editor/VersionDrawer.vue';
import ExportDialog from '../../components/editor/ExportDialog.vue';
import ImportDialog from '../../components/editor/ImportDialog.vue';
import ContentCheckPanel from '../../components/editor/ContentCheckPanel.vue';
import AiRewriteDrawer from '../../components/editor/AiRewriteDrawer.vue';
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
  MoreHorizontal,
  History,
  FileUp,
  ListChecks,
  Wand2
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
const isShareDialogOpen = ref(false);
const isVersionDrawerOpen = ref(false);
const isExportDialogOpen = ref(false);
const isImportDialogOpen = ref(false);
const isContentCheckOpen = ref(false);
const isAiRewriteOpen = ref(false);
const autoFitToast = ref<string | null>(null);
/** 小屏下把次要操作收进「更多」菜单 */
const isMoreMenuOpen = ref(false);

function runFromMenu(action: () => void | Promise<void>) {
  isMoreMenuOpen.value = false;
  void action();
}

const handleAutoFit = async () => {
  const res = await resumeStore.autoFitOnePage();
  autoFitToast.value = res.success
    ? res.message
    : `${res.message}（可点击「撤销排版」恢复原样）`;
  setTimeout(() => {
    autoFitToast.value = null;
  }, res.success ? 3500 : 6000);
};

const handleUndoAutoFit = () => {
  const restored = resumeStore.undoAutoFit();
  autoFitToast.value = restored ? '已撤销本次自动排版' : '没有可撤销的自动排版';
  setTimeout(() => {
    autoFitToast.value = null;
  }, 3000);
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

  isShareDialogOpen.value = true;
};

/** 版本历史：与分享一样，本地草稿没有云端版本 */
const handleVersions = () => {
  if (!isShareable()) {
    autoFitToast.value = authStore.isLoggedIn
      ? '本地草稿没有云端版本历史，请先保存到云端'
      : '版本历史需要登录后使用';
    setTimeout(() => {
      autoFitToast.value = null;
    }, 4000);
    return;
  }
  isVersionDrawerOpen.value = true;
};

/** 恢复版本后把内容推回 store，同时清空撤销栈由父级决定 */
const handleVersionRestored = (payload: {
  title: string;
  templateId: string;
  content: any;
  themeConfig: any;
}) => {
  resumeStore.loadResumeData({
    id: resumeStore.id,
    title: payload.title,
    templateId: payload.templateId,
    content: payload.content,
    themeConfig: payload.themeConfig
  });
  isVersionDrawerOpen.value = false;
};

/**
 * 导出前的内容体检。
 *
 * 只提示、不拦截：用户比任何启发式规则都清楚这份简历能不能投。
 * 提示优先展示 error，没有 error 时展示第一条 warning（通常是占位符残留）。
 * 真正的格式选择交给 ExportDialog —— 这里只负责「体检 + 打开弹窗」。
 */
const handleExport = () => {
  const issues = checkResumeContent(resumeStore.content);
  const blocking = issues.filter((issue) => issue.severity === 'error');
  const preview = blocking[0] ?? issues.find((issue) => issue.severity === 'warning');
  if (preview) {
    autoFitToast.value = blocking.length
      ? `导出前提醒：${preview.message}${blocking.length > 1 ? `（共 ${blocking.length} 项）` : ''}`
      : `导出前提醒：${preview.message}`;
    setTimeout(() => {
      autoFitToast.value = null;
    }, 4500);
  }

  isExportDialogOpen.value = true;
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
      <!--
        返回目标随登录态变化：登录用户的「上一级」是工作台（那里能管理多份简历），
        游客没有工作台，只能回首页。始终回首页会让登录用户多绕一步。
      -->
      <router-link
        :to="authStore.isLoggedIn ? '/dashboard' : '/'"
        class="flex items-center gap-1.5 font-bold text-primary-600 hover:opacity-80 transition text-sm"
        :title="authStore.isLoggedIn ? '返回我的简历' : '返回首页'"
      >
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
        <!-- 编辑器页面的唯一 h1：简历标题本身就是这一页的主标题 -->
        <h1
          v-else
          @click="isEditingTitle = true"
          title="点击重命名"
          class="text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition max-w-[130px] sm:max-w-xs truncate"
        >
          {{ resumeStore.title }}
        </h1>

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

      <!-- 自动排版：迭代收敛到目标页数 -->
      <button
        @click="handleAutoFit"
        title="自动调整间距与字号，将内容收敛到单页 A4"
        class="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition shadow-xs group"
      >
        <Sparkles class="w-3.5 h-3.5 text-primary-600 group-hover:rotate-12 transition transform" />
        <span>一键单页</span>
      </button>

      <button
        v-if="resumeStore.canUndoAutoFit"
        @click="handleUndoAutoFit"
        title="撤销最近一次自动排版"
        class="hidden md:inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <RotateCcw class="w-3.5 h-3.5 text-slate-500" />
        <span>撤销排版</span>
      </button>

      <!-- 目标岗位 JD 关键词对照 -->
      <button
        @click="$emit('toggleAtsModal')"
        title="对照招聘要求检查关键词覆盖情况（本地计算，仅供参考）"
        class="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition shadow-xs group cursor-pointer"
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

      <!--
        AI 改写：标签只在足够宽时才出现。
        编辑器顶栏在 md 断点已经排了七八个按钮，再加一个带文字的必然溢出，
        而这段宽度又看不到「更多」菜单（那是 md:hidden），所以保留图标本身。
      -->
      <button
        @click="isAiRewriteOpen = true"
        aria-label="AI 改写"
        title="用你自己的模型改写某一段描述（会显示改动对照）"
        class="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-2.5 py-1.5 rounded-lg transition shadow-xs group"
      >
        <Wand2 class="w-3.5 h-3.5 text-primary-600 group-hover:rotate-12 transition transform" aria-hidden="true" />
        <span class="hidden xl:inline">AI 改写</span>
      </button>

      <button
        @click="handleVersions"
        title="查看与恢复历史版本"
        class="hidden lg:inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition"
      >
        <History class="w-3.5 h-3.5 text-slate-500" />
        <span>版本</span>
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
          @click="runFromMenu(handleVersions)"
        >
          <History class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>版本历史</span>
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
          @click="runFromMenu(() => { isContentCheckOpen = true; })"
        >
          <ListChecks class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>内容检查</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(() => { isAiRewriteOpen = true; })"
        >
          <Wand2 class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>AI 改写</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          @click="runFromMenu(() => { isImportDialogOpen = true; })"
        >
          <FileUp class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>导入简历</span>
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

      <!-- 导出入口：格式选择（PDF / Word / Markdown / JSON）在弹窗里 -->
      <AppButton size="sm" aria-label="导出简历" @click="handleExport">
        <template #icon>
          <Download class="w-4 h-4" aria-hidden="true" />
        </template>
        <span class="hidden sm:inline">导出</span>
      </AppButton>
    </div>

    <!-- 登录/注册弹窗 -->
    <AuthModal
      :isOpen="isAuthModalOpen"
      @close="isAuthModalOpen = false"
      @success="resumeStore.saveResume"
    />

    <!-- 分享设置：token 化链接、有效期、密码、二维码 -->
    <ShareDialog
      v-if="isShareable()"
      :open="isShareDialogOpen"
      :resume-id="resumeStore.id"
      :resume-title="resumeStore.title"
      :is-public="resumeStore.isPublic"
      @update:open="isShareDialogOpen = $event"
      @update:is-public="resumeStore.isPublic = $event"
    />

    <!-- 版本历史 -->
    <VersionDrawer
      v-if="isShareable()"
      :open="isVersionDrawerOpen"
      :resume-id="resumeStore.id"
      @update:open="isVersionDrawerOpen = $event"
      @restored="handleVersionRestored"
    />

    <!-- 导出：PDF / Word / Markdown / JSON -->
    <ExportDialog :is-open="isExportDialogOpen" @close="isExportDialogOpen = false" />

    <!-- 导入：JSON 备份 / 粘贴文本 / Markdown -->
    <ImportDialog :is-open="isImportDialogOpen" @close="isImportDialogOpen = false" />

    <!-- 内容检查：逐条 bullet 的量化/动词/长度/占位符 -->
    <ContentCheckPanel v-model:open="isContentCheckOpen" />

    <!-- AI 改写：自带 Key，结果必须过 diff 才会写回正文 -->
    <AiRewriteDrawer v-model:open="isAiRewriteOpen" />

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
