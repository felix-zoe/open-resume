<script setup lang="ts">
import { ref, onMounted } from 'vue';
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

onMounted(async () => {
  // 1. 若 URL query 中带了 template 参数，自动激活对应模板
  if (route.query.template && typeof route.query.template === 'string') {
    resumeStore.templateId = route.query.template;
  }

  // 2. 若进入的是指定简历 ID 且已登录，拉取云端数据
  const resumeId = route.params.id as string;
  if (resumeId && resumeId !== 'demo' && resumeId !== 'local-draft') {
    resumeStore.id = resumeId;
    if (authStore.isLoggedIn) {
      try {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        });
        const data: any = await res.json();
        if (data.code === 0 && data.data) {
          resumeStore.title = data.data.title || resumeStore.title;
          resumeStore.templateId = data.data.templateId || resumeStore.templateId;
          resumeStore.content = data.data.content || resumeStore.content;
          resumeStore.themeConfig = data.data.themeConfig || resumeStore.themeConfig;
        }
      } catch (err) {
        console.error('拉取云端简历数据失败:', err);
      }
    }
  }
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
    <!-- 顶部操作导航 -->
    <EditorHeader
      @toggleStyleDrawer="isStyleDrawerOpen = true"
      @toggleTemplateModal="isTemplateModalOpen = true"
      @toggleAtsModal="isAtsModalOpen = true"
    />

    <!-- 编辑器主体：左表单 + 右画板 -->
    <main class="flex-1 flex overflow-hidden">
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
