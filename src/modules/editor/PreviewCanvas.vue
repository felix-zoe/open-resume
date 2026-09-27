<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useResumeStore } from '../../stores/resume';
import ClassicTemplate from '../../templates/ClassicTemplate.vue';
import GeekTemplate from '../../templates/GeekTemplate.vue';
import ModernTemplate from '../../templates/ModernTemplate.vue';

const resumeStore = useResumeStore();
const paperRef = ref<HTMLElement | null>(null);
const contentHeight = ref<number>(0);

// A4 纸张在 96 DPI 下的物理像素高度约为 1123px
const A4_HEIGHT_PX = 1123;

// 动态匹配模板组件
const currentTemplateComponent = computed(() => {
  switch (resumeStore.templateId) {
    case 'geek':
      return GeekTemplate;
    case 'modern':
      return ModernTemplate;
    case 'classic':
    default:
      return ClassicTemplate;
  }
});

// 计算当前跨了多少页以及截断线的位置
const breakLinePositions = computed(() => {
  const lines: number[] = [];
  let currentY = A4_HEIGHT_PX;
  while (contentHeight.value > currentY) {
    lines.push(currentY);
    currentY += A4_HEIGHT_PX;
  }
  return lines;
});

// 更新内容实际高度
const updateHeight = () => {
  if (paperRef.value) {
    contentHeight.value = paperRef.value.scrollHeight;
  }
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    updateHeight();
    if (paperRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(paperRef.value);
    }
  });
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
});

watch(
  () => [resumeStore.content, resumeStore.themeConfig, resumeStore.templateId],
  () => {
    nextTick(updateHeight);
  },
  { deep: true }
);
</script>

<template>
  <div class="preview-canvas-wrapper flex-1 bg-slate-100/80 overflow-y-auto flex justify-center p-6 relative select-none">
    <!-- 外层缩放包装容器 -->
    <div
      class="canvas-zoom-container transition-transform duration-150 origin-top flex flex-col items-center"
      :style="{ transform: `scale(${resumeStore.zoom})` }"
    >
      <!-- A4 纸张实体 -->
      <div
        ref="paperRef"
        class="a4-page a4-print-target bg-white shadow-xl rounded-sm transition-all duration-200 relative select-text"
        style="width: 210mm; min-height: 297mm;"
      >
        <!-- 动态模板加载 -->
        <component
          :is="currentTemplateComponent"
          :content="resumeStore.content"
          :theme="resumeStore.themeConfig"
        />

        <!-- 动态分页指示虚线 (仅屏幕预览可见，打印时自动隐藏) -->
        <template v-for="(yPos, index) in breakLinePositions" :key="index">
          <div
            class="page-indicator-line no-print absolute left-0 w-full pointer-events-none z-10 flex items-center justify-between"
            :style="{ top: `${yPos}px` }"
          >
            <div class="w-full border-b-2 border-dashed border-rose-400 opacity-70"></div>
            <span class="absolute right-4 -top-3 bg-rose-50 text-rose-600 text-[10px] font-mono px-2 py-0.5 rounded border border-rose-300 shadow-xs">
              ⚠️ 第 {{ index + 1 }} 页截断线 (建议微调间距收敛)
            </span>
          </div>
        </template>
      </div>

      <!-- 页底高度提示 -->
      <div class="no-print mt-4 text-xs text-gray-400 font-mono">
        A4 标准幅面 (210mm × 297mm) · 当前约 {{ Math.ceil(contentHeight / A4_HEIGHT_PX) || 1 }} 页
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-canvas-wrapper {
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
