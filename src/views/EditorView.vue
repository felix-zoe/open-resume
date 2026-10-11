<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useResumeStore } from '../stores/resume';
import { useAuthStore } from '../stores/auth';
import EditorHeader from '../modules/editor/EditorHeader.vue';
import FormPanel from '../modules/editor/FormPanel.vue';
import PreviewCanvas from '../modules/editor/PreviewCanvas.vue';
import StyleDrawer from '../modules/editor/StyleDrawer.vue';
import TemplateModal from '../components/TemplateModal.vue';
import AtsModal from '../components/AtsModal.vue';

const route = useRoute();
const resumeStore = useResumeStore();
const authStore = useAuthStore();

const isStyleDrawerOpen = ref(false);
const isTemplateModalOpen = ref(false);
const isAtsModalOpen = ref(false);

// 监听路由参数 ID 变化，作为统一入口加载指定简历
watch(
  () => route.params.id,
  async (newId) => {
    const resumeId = (newId as string) || 'local-draft';

    // 1. 若 URL query 中带了 template 参数，预设模板
    if (route.query.template && typeof route.query.template === 'string') {
      resumeStore.templateId = route.query.template;
    }

    // 2. Demo 示例演示路径
    if (resumeId === 'demo') {
      resumeStore.resetToPreset();
      resumeStore.id = 'demo';
      return;
    }

    // 3. 纯本地草稿路径
    if (resumeId === 'local-draft') {
      const restored = resumeStore.loadLocalDraft('local-draft');
      if (!restored) {
        resumeStore.resetToPreset();
        resumeStore.id = 'local-draft';
      }
      return;
    }

    // 4. 具名或云端简历：先读本地缓存草稿保底响应
    resumeStore.id = resumeId;
    resumeStore.loadLocalDraft(resumeId);

    // 5. 若已登录，从云端拉取权威数据
    if (authStore.isLoggedIn) {
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        });
        const data: any = await res.json();
        if (data.code === 0 && data.data) {
          resumeStore.loadResumeData({
            id: resumeId,
            title: data.data.title,
            templateId: data.data.templateId,
            content: data.data.content,
            themeConfig: data.data.themeConfig
          });
        }
      } catch (err) {
        console.error('拉取云端简历数据失败:', err);
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="editor-view-root h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
    <!-- 顶部操作导航 -->
    <EditorHeader
      @toggleStyleDrawer="isStyleDrawerOpen = true"
      @toggleTemplateModal="isTemplateModalOpen = true"
      @toggleAtsModal="isAtsModalOpen = true"
    />

    <!-- 编辑器主体：左表单 + 右画板 -->
    <main class="editor-main-area flex-1 flex overflow-hidden">
      <!-- 左侧表单输入区 -->
      <FormPanel />

      <!-- 右侧 A4 真实排版画板 -->
      <PreviewCanvas />
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
