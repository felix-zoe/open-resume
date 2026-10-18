<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useResumeStore } from '../stores/resume';
import { useAuthStore } from '../stores/auth';
import { useMediaQuery } from '../composables/useMediaQuery';
import { AppTabs } from '../components/ui';
import { apiFetch } from '../utils/http';
import type { ResumeContent, ThemeConfig } from '../types/resume';
import EditorHeader from '../modules/editor/EditorHeader.vue';
import FormPanel from '../modules/editor/FormPanel.vue';
import PreviewCanvas from '../modules/editor/PreviewCanvas.vue';
import StyleDrawer from '../modules/editor/StyleDrawer.vue';
import TemplateModal from '../components/TemplateModal.vue';
import AtsModal from '../components/AtsModal.vue';

const route = useRoute();
const router = useRouter();
const resumeStore = useResumeStore();
const authStore = useAuthStore();

const isStyleDrawerOpen = ref(false);
const isTemplateModalOpen = ref(false);
const isAtsModalOpen = ref(false);

/**
 * 移动端把「表单 / 预览」拆成两个 Tab。
 * 用 v-show 而不是 v-if：切走再切回时表单的滚动位置、展开状态、输入焦点都保留。
 */
const isMobileLayout = useMediaQuery('(max-width: 1023px)');
const mobileTab = ref<'content' | 'preview'>('content');
const mobileTabs = [
  { key: 'content', label: '填写内容' },
  { key: 'preview', label: '预览排版' }
];

// 监听路由参数 ID 变化，作为统一入口加载指定简历
watch(
  () => route.params.id,
  async (newId) => {
    const resumeId = (newId as string) || 'local-draft';

    // 1. 若 URL query 中带了 template 参数，预设模板
    if (route.query.template && typeof route.query.template === 'string') {
      resumeStore.templateId = route.query.template;
    }

    // 2. 新建入口：生成独立本地草稿并替换 URL，避免后续刷新丢失
    if (resumeId === 'new') {
      const template = typeof route.query.template === 'string' ? route.query.template : undefined;
      const newId = resumeStore.createLocalId();
      resumeStore.createLocalDraft(newId, { templateId: template });
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
        }>(`/api/resumes/${resumeId}`);
        // 路由已切走时丢弃过期响应，避免串改当前简历
        if ((route.params.id as string) !== resumeId) return;
        if (result.ok && result.data) {
          resumeStore.loadResumeData({
            id: resumeId,
            title: result.data.title,
            templateId: result.data.templateId,
            content: result.data.content,
            themeConfig: result.data.themeConfig
          });
        }
      } finally {
        resume();
      }
    }
  },
  { immediate: true }
);
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

      <!-- 右侧 A4 真实排版画板 -->
      <PreviewCanvas v-show="!isMobileLayout || mobileTab === 'preview'" />
    </main>

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

    <!-- 目标岗位 JD 诊断与 ATS 评分模态框 -->
    <AtsModal
      :isOpen="isAtsModalOpen"
      @close="isAtsModalOpen = false"
    />
  </div>
</template>
