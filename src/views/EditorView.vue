<script setup lang="ts">
import { ref } from 'vue';
import EditorHeader from '../modules/editor/EditorHeader.vue';
import FormPanel from '../modules/editor/FormPanel.vue';
import PreviewCanvas from '../modules/editor/PreviewCanvas.vue';
import StyleDrawer from '../modules/editor/StyleDrawer.vue';
import TemplateModal from '../components/TemplateModal.vue';

const isStyleDrawerOpen = ref(false);
const isTemplateModalOpen = ref(false);
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
    <!-- 顶部操作导航 -->
    <EditorHeader
      @toggleStyleDrawer="isStyleDrawerOpen = true"
      @toggleTemplateModal="isTemplateModalOpen = true"
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
  </div>
</template>
