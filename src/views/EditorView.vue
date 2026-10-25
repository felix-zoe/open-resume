<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useResumeStore } from '../stores/resume';
import { useAuthStore } from '../stores/auth';
import { useMediaQuery } from '../composables/useMediaQuery';
import { useLeaveGuard, useUndoRedo } from '../composables/useUndoRedo';
import { useToast } from '../composables/useToast';
import { AppButton, AppTabs } from '../components/ui';
import { apiFetch } from '../utils/http';
import type { ResumeContent, ThemeConfig } from '../types/resume';
import EditorHeader from '../modules/editor/EditorHeader.vue';
import FormPanel from '../modules/editor/FormPanel.vue';
import PreviewCanvas from '../modules/editor/PreviewCanvas.vue';
import StyleDrawer from '../modules/editor/StyleDrawer.vue';
import StylePanel from '../modules/editor/StylePanel.vue';
import TemplateModal from '../components/TemplateModal.vue';
import AtsModal from '../components/AtsModal.vue';
import ExportDialog from '../components/editor/ExportDialog.vue';
import { Download } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const resumeStore = useResumeStore();
const authStore = useAuthStore();

const isStyleDrawerOpen = ref(false);
const isTemplateModalOpen = ref(false);
const isAtsModalOpen = ref(false);
const isExportDialogOpen = ref(false);

/**
 * 移动端把「填写 / 预览 / 样式」拆成三个 Tab。
 * 用 v-show 而不是 v-if：切走再切回时表单的滚动位置、展开状态、输入焦点都保留。
 * 样式单独成 Tab 而不是沿用抽屉：手机屏幕宽度下抽屉会盖住整个画布，
 * 调字号时看不到效果；内联展示至少能一边调一边瞥见预览。
 */
const isMobileLayout = useMediaQuery('(max-width: 1023px)');
const mobileTab = ref<'content' | 'preview' | 'style'>('content');
const mobileTabs = [
  { key: 'content', label: '填写内容' },
  { key: 'preview', label: '预览排版' },
  { key: 'style', label: '排版样式' }
];

const toast = useToast();

/**
 * 撤销 / 重做：覆盖内容、主题、标题、模板四类可编辑状态。
 * 云端或本地草稿加载完成后会清空历史，避免撤回到上一份简历。
 */
const history = useUndoRedo({
  snapshot: () => ({
    content: resumeStore.content,
    themeConfig: resumeStore.themeConfig,
    title: resumeStore.title,
    templateId: resumeStore.templateId
  }),
  restore: (snapshot) => {
    resumeStore.content = snapshot.content;
    resumeStore.themeConfig = snapshot.themeConfig;
    resumeStore.title = snapshot.title;
    resumeStore.templateId = snapshot.templateId;
  },
  sources: [
    computed(() => resumeStore.content),
    computed(() => resumeStore.themeConfig),
    computed(() => resumeStore.title),
    computed(() => resumeStore.templateId)
  ]
});

/** 有未落盘改动时，关闭标签页要拦一下 */
useLeaveGuard(() => resumeStore.saveStatus === 'unsaved' || resumeStore.saveStatus === 'saving');

const handleKeydown = (event: KeyboardEvent) => {
  const isMod = event.ctrlKey || event.metaKey;
  if (!isMod) return;

  // 输入法组合中不拦截，否则会吞掉候选词操作
  if (event.isComposing) return;

  const key = event.key.toLowerCase();

  if (key === 'z' && !event.shiftKey) {
    if (history.undo()) {
      event.preventDefault();
      toast.info('已撤销');
    }
    return;
  }

  if ((key === 'z' && event.shiftKey) || key === 'y') {
    if (history.redo()) {
      event.preventDefault();
      toast.info('已重做');
    }
    return;
  }

  if (key === 's') {
    event.preventDefault();
    void resumeStore.saveResume();
    toast.success('已触发保存');
  }
};

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

// 监听路由参数 ID 变化，作为统一入口加载指定简历
watch(
  () => route.params.id,
  async (newId) => {
    await loadResumeForId(newId as string);
    // 换了简历就清空撤销栈，否则会撤回到上一份简历的内容
    history.reset();
  },
  { immediate: true }
);

async function loadResumeForId(rawId: string) {
  const resumeId = rawId || 'local-draft';

  // 1. 若 URL query 中带了 template 参数，预设模板
  if (route.query.template && typeof route.query.template === 'string') {
    resumeStore.templateId = route.query.template;
  }

  // 2. 新建入口：生成独立本地草稿并替换 URL，避免后续刷新丢失
  if (resumeId === 'new') {
    const template = typeof route.query.template === 'string' ? route.query.template : undefined;
    const locale = typeof route.query.locale === 'string' ? route.query.locale : undefined;
    const newId = resumeStore.createLocalId();
    resumeStore.createLocalDraft(newId, { templateId: template, locale });
    await router.replace({ name: 'Editor', params: { id: newId } });
    return;
  }

  // 3. Demo 示例演示路径：优先恢复用户上次编辑的示例草稿，仅在无草稿或 ?fresh=1 时重置
  if (resumeId === 'demo') {
    resumeStore.id = 'demo';
    const wantsFresh = route.query.fresh === '1';
    const restored = !wantsFresh && resumeStore.loadLocalDraft('demo');
    if (!restored) {
      resumeStore.resetToPreset();
      resumeStore.id = 'demo';
      resumeStore.persistLocalDraft();
    }
    return;
  }

  // 4. 纯本地草稿路径（兼容旧链接）
  if (resumeId === 'local-draft') {
    const restored = resumeStore.loadLocalDraft('local-draft');
    if (!restored) {
      const newId = resumeStore.createLocalId();
      resumeStore.createLocalDraft(newId);
      await router.replace({ name: 'Editor', params: { id: newId } });
    }
    return;
  }

  // 5. 具名或云端简历：先读本地缓存草稿保底响应
  resumeStore.id = resumeId;
  resumeStore.loadLocalDraft(resumeId);

  // 6. 若已登录，从云端拉取权威数据。
  //    整个请求周期都持有暂停锁：慢网络下用户在加载期间编辑的内容不会被
  //    云端响应覆盖，也不会把加载中的状态误写回服务器。
  if (authStore.isLoggedIn) {
    const resume = resumeStore.suspendAutoSave();
    try {
      const result = await apiFetch<{
        title: string;
        templateId: string;
        content: ResumeContent;
        themeConfig: ThemeConfig;
        isPublic?: number;
      }>(`/api/resumes/${resumeId}`);
      // 路由已切走时丢弃过期响应，避免串改当前简历
      if ((route.params.id as string) !== resumeId) return;
      if (result.ok && result.data) {
        resumeStore.loadResumeData({
          id: resumeId,
          title: result.data.title,
          templateId: result.data.templateId,
          content: result.data.content,
          themeConfig: result.data.themeConfig,
          isPublic: result.data.isPublic
        });
      }
    } finally {
      resume();
    }
  }
}
</script>

<template>
  <div class="editor-view-root h-[100dvh] flex flex-col bg-slate-50 overflow-hidden font-sans">
    <!-- 顶部操作导航 -->
    <EditorHeader
      @toggleStyleDrawer="isStyleDrawerOpen = true"
      @toggleTemplateModal="isTemplateModalOpen = true"
      @toggleAtsModal="isAtsModalOpen = true"
    />

    <!-- 移动端：内容 / 预览 切换 -->
    <div v-if="isMobileLayout" class="no-print lg:hidden px-4 py-2 bg-white border-b border-slate-200">
      <AppTabs v-model="mobileTab" :tabs="mobileTabs" block aria-label="编辑器视图" />
    </div>

    <!-- 编辑器主体：左表单 + 右画板 -->
    <main id="main-content" tabindex="-1" class="editor-main-area flex-1 flex overflow-hidden">
      <!-- 左侧表单输入区 -->
      <FormPanel v-show="!isMobileLayout || mobileTab === 'content'" />

      <!-- 移动端「样式」Tab：内联渲染同一份排版面板，不弹抽屉 -->
      <aside
        v-if="isMobileLayout"
        v-show="mobileTab === 'style'"
        class="w-full bg-white overflow-y-auto no-print"
        aria-label="排版样式"
      >
        <div class="p-4">
          <StylePanel />
        </div>
      </aside>

      <!-- 右侧 A4 真实排版画板 -->
      <PreviewCanvas v-show="!isMobileLayout || mobileTab === 'preview'" />
    </main>

    <!--
      移动端底部固定导出条：小屏下 Header 里的导出按钮只有图标且容易被忽略，
      而「填完就想导出」是编辑完成后的主要动作，给一个始终可见的入口。
    -->
    <div
      v-if="isMobileLayout"
      class="no-print shrink-0 bg-white border-t border-slate-200 px-4 py-2.5 flex items-center gap-2"
    >
      <p class="flex-1 text-2xs text-slate-500 leading-snug">
        内容自动保存 · 导出后可直接投递
      </p>
      <!-- 无 aria-label：可访问名取按钮文字「导出」，与 Header 的「导出简历」区分开 -->
      <AppButton size="sm" @click="isExportDialogOpen = true">
        <template #icon>
          <Download class="w-4 h-4" aria-hidden="true" />
        </template>
        <span>导出</span>
      </AppButton>
    </div>

    <!-- 排版微调侧边抽屉 -->
    <StyleDrawer
      :isOpen="isStyleDrawerOpen"
      @close="isStyleDrawerOpen = false"
    />

    <!-- 模板切换模态框 -->
    <TemplateModal
      :isOpen="isTemplateModalOpen"
      @close="isTemplateModalOpen = false"
    />

    <!-- 目标岗位 JD 关键词对照（不输出总分，只给可解释的覆盖度） -->
    <AtsModal
      :isOpen="isAtsModalOpen"
      @close="isAtsModalOpen = false"
    />

    <!-- 移动端底部导出条打开的格式弹窗（桌面端由 Header 自己挂载一份） -->
    <ExportDialog
      v-if="isMobileLayout"
      :is-open="isExportDialogOpen"
      @close="isExportDialogOpen = false"
    />
  </div>
</template>
