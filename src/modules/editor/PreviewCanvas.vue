<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useResumeStore } from "../../stores/resume";
import ClassicTemplate from "../../templates/ClassicTemplate.vue";
import GeekTemplate from "../../templates/GeekTemplate.vue";
import ModernTemplate from "../../templates/ModernTemplate.vue";
import AtsTemplate from "../../templates/AtsTemplate.vue";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  MM_TO_PX,
  RESUME_DOC_SELECTOR,
  getBreakLines,
  getPageCount,
  getUsableHeight,
} from "../../utils/a4";

const resumeStore = useResumeStore();
const paperRef = ref<HTMLElement | null>(null);
const contentHeight = ref<number>(0);

/**
 * 页边距由纸张承担，而不是模板根节点。
 *
 * 这样打印时 `@page { margin }` 会给每一页都留出边距；预览里用同样的
 * padding，断线位置才能和真实分页对齐。
 */
const pagePaddingPx = computed(() => {
  const mm = Number(resumeStore.themeConfig.pagePadding);
  return Number.isFinite(mm) && mm >= 0 ? mm * MM_TO_PX : 0;
});

/**
 * Modern 模板的侧栏底色需要铺满整张纸，因此它自己承担页边距；
 * 其余模板由纸张统一提供 padding。两者的可用高度算法一致。
 */
const paperOwnsPadding = computed(() => resumeStore.templateId !== "modern");

const paperPaddingStyle = computed(() => {
  if (!paperOwnsPadding.value) return {};
  const px = pagePaddingPx.value;
  return {
    paddingTop: `${px}px`,
    paddingBottom: `${px}px`,
    paddingLeft: `${px}px`,
    paddingRight: `${px}px`,
  };
});

/** 一页能容纳的内容高度（已扣除上下页边距） */
const usableHeight = computed(() => getUsableHeight(resumeStore.themeConfig.pagePadding));

const pageCount = computed(() => getPageCount(contentHeight.value, usableHeight.value));

// 动态匹配模板组件
const currentTemplateComponent = computed(() => {
  switch (resumeStore.templateId) {
    case "geek":
      return GeekTemplate;
    case "modern":
      return ModernTemplate;
    case "ats":
      return AtsTemplate;
    case "classic":
    default:
      return ClassicTemplate;
  }
});

// 断线位置与页数共用同一套度量，避免“显示 2 页但没有断线”这类矛盾
const breakLinePositions = computed(() => getBreakLines(contentHeight.value, usableHeight.value));

/** 断线在屏幕上的 y 坐标 = 内容坐标 + 纸张顶部 padding */
const breakLineStyles = computed(() =>
  breakLinePositions.value.map((y) => ({ top: `${y + pagePaddingPx.value}px` }))
);

/**
 * 尺寸补偿容器：外层占位按缩放后的实际尺寸参与布局。
 *
 * 裸 `transform: scale()` 不改变布局尺寸，缩小到 50% 时右侧与底部会留下
 * 一大片空白且无法滚到内容边缘；放大到 150% 时内容又会溢出容器被裁掉。
 * 这里让占位块 = 纸张尺寸 × zoom，再让纸张从左上角缩放。
 */
const zoom = computed(() => {
  const value = Number(resumeStore.zoom);
  return Number.isFinite(value) && value > 0 ? value : 1;
});

const scalerStyle = computed(() => {
  const naturalHeight = Math.max(contentHeight.value, A4_HEIGHT_PX);
  return {
    width: `${A4_WIDTH_PX * zoom.value}px`,
    height: `${naturalHeight * zoom.value}px`,
  };
});

const canvasStyle = computed(() => ({
  width: `${A4_WIDTH_PX}px`,
  transform: `scale(${zoom.value})`,
  transformOrigin: "top left",
}));

// 测量内容节点，而不是纸张：纸张自带 min-height:297mm，测它永远等于一页
const updateHeight = () => {
  const paper = paperRef.value;
  if (!paper) return;
  const doc =
    (paper.querySelector(RESUME_DOC_SELECTOR) as HTMLElement | null) ??
    (paper.firstElementChild as HTMLElement | null);
  contentHeight.value = doc ? doc.scrollHeight : 0;
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    updateHeight();
    if (paperRef.value && typeof ResizeObserver !== "undefined") {
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
  { deep: true },
);
</script>

<template>
  <div
    class="preview-canvas-wrapper flex-1 bg-slate-100/80 overflow-auto flex p-6 relative select-none"
  >
    <!--
      居中用 `m-auto` 而不是 `justify-center`：flex 居中对溢出内容会把左右两侧
      各裁掉一半且无法滚到，auto margin 在空间不足时会退化为 0，不会裁切。
    -->
    <div
      class="m-auto shrink-0 flex flex-col items-center"
      :style="{ width: scalerStyle.width }"
    >
      <!-- 尺寸补偿容器：高度随缩放变化，保证可完整滚动 -->
      <div class="zoom-scaler relative" :style="scalerStyle">
        <div class="canvas-zoom-container" :style="canvasStyle">
          <!-- A4 纸张实体：页边距由纸张承担，多页时每页都有完整留白 -->
          <div
            ref="paperRef"
            class="a4-page a4-print-target bg-white shadow-xl rounded-sm relative select-text"
            :style="paperPaddingStyle"
            role="document"
            :aria-label="`${resumeStore.title || '简历'} 预览`"
          >
            <!-- 动态模板加载 -->
            <component
              :is="currentTemplateComponent"
              :content="resumeStore.content"
              :theme="resumeStore.themeConfig"
            />

            <!-- 动态分页指示虚线 (仅屏幕预览可见，打印时自动隐藏) -->
            <template v-for="(lineStyle, index) in breakLineStyles" :key="index">
              <div
                class="page-indicator-line no-print absolute left-0 w-full pointer-events-none z-10 flex items-center justify-between"
                :style="lineStyle"
              >
                <div
                  class="w-full border-b-2 border-dashed border-rose-400 opacity-70"
                ></div>
                <span
                  class="absolute right-4 -top-3 bg-rose-50 text-rose-600 text-2xs font-mono px-2 py-0.5 rounded border border-rose-300 shadow-xs"
                >
                  第 {{ index + 1 }} 页截断线
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 页底高度提示 -->
      <div class="no-print mt-4 text-xs text-slate-500 font-mono">
        A4 标准幅面 (210mm × 297mm) · 当前约 {{ pageCount }} 页
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-canvas-wrapper {
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 20px 20px;
}

/* 纸张高度由内容撑开；min-height 保证短内容仍是一整页 */
.a4-page {
  min-height: 1122.52px;
}
</style>
