<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ClassicTemplate from '../../templates/ClassicTemplate.vue';
import GeekTemplate from '../../templates/GeekTemplate.vue';
import ModernTemplate from '../../templates/ModernTemplate.vue';
import AtsTemplate from '../../templates/AtsTemplate.vue';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../../utils/presets';
import { A4_WIDTH_PX } from '../../utils/a4';
import type { ResumeContent, ThemeConfig } from '../../types/resume';

/**
 * 真实模板预览。
 *
 * 不用截图或手绘骨架：直接挂载真实模板组件并整体缩放，
 * 首页看到的排版与编辑器里完全一致，模板改动会同步反映。
 * 按容器宽度动态换算 scale，卡片在任意栅格宽度下都填满且不变形。
 */
const props = withDefaults(
  defineProps<{
    templateId: 'classic' | 'geek' | 'modern' | 'ats';
    /** 可选内容：示例页要展示岗位专属的范文，缺省用默认范文 */
    content?: ResumeContent;
    /** 可选主题：缺省用默认主题配置 */
    theme?: ThemeConfig;
  }>(),
  { content: undefined, theme: undefined }
);

const rootRef = ref<HTMLElement | null>(null);
const scale = ref(0.24);

const component = computed(() => {
  if (props.templateId === 'geek') return GeekTemplate;
  if (props.templateId === 'modern') return ModernTemplate;
  if (props.templateId === 'ats') return AtsTemplate;
  return ClassicTemplate;
});

const content = computed(() => props.content ?? DEFAULT_RESUME_CONTENT);
const theme = computed(() => props.theme ?? DEFAULT_THEME_CONFIG);

let observer: ResizeObserver | null = null;

function updateScale() {
  const width = rootRef.value?.clientWidth ?? 0;
  if (width > 0) scale.value = width / A4_WIDTH_PX;
}

onMounted(() => {
  updateScale();
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(updateScale);
    observer.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <!--
    `inert` 与 `aria-hidden` 一起用：预览是装饰，里面的模板链接不该进 Tab 顺序。
    只写 aria-hidden 时，读屏器会忽略它们但键盘仍能聚焦到隐藏区域内的链接
    （axe 的 aria-hidden-focus 规则会直接判 serious）。
  -->
  <div
    ref="rootRef"
    class="template-preview relative overflow-hidden bg-slate-100"
    aria-hidden="true"
    inert
  >
    <div class="template-preview-scaler" :style="{ transform: `scale(${scale})` }">
      <div class="w-[210mm] min-h-[297mm] bg-white">
        <component :is="component" :content="content" :theme="theme" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-preview {
  /* 卡片按 A4 比例裁切，缩放后不会留下底部空白 */
  aspect-ratio: 210 / 297;
}

.template-preview-scaler {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
  user-select: none;
}
</style>
