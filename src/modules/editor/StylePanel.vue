<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Sparkles } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppButton, AppSwitch } from '../../components/ui';
import { useToast } from '../../composables/useToast';
import { cx } from '../../components/ui/utils';
import type { ResumeLocale } from '../../../shared/types';

/**
 * 排版设置面板本体。
 *
 * 桌面端由 `StyleDrawer` 包在抽屉里，移动端直接作为「样式」Tab 的内容渲染。
 * 拆出来的原因：移动端从右侧滑出抽屉会盖住整个画布，而 Tab 内联展示
 * 可以让用户边调字号边看到下方的预览缩略。
 */

const resumeStore = useResumeStore();
const toast = useToast();

/** 自动排版的目标页数 */
const targetPages = ref<1 | 2>(1);
const isAutoFitting = ref(false);

const triggerAutoFit = async () => {
  if (isAutoFitting.value) return;
  isAutoFitting.value = true;
  try {
    const result = await resumeStore.autoFitOnePage(targetPages.value);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  } finally {
    isAutoFitting.value = false;
  }
};

// 预设主题色系
const PRESET_COLORS = [
  { name: '科技商务蓝', value: '#2563EB' },
  { name: '曜石深邃黑', value: '#1E293B' },
  { name: '远峰雅致青', value: '#0D9488' },
  { name: '沉稳翡翠绿', value: '#059669' },
  { name: '经典故宫红', value: '#DC2626' },
  { name: '优雅梦幻紫', value: '#7C3AED' },
  { name: '琥珀暖阳橙', value: '#D97706' },
  { name: '钛金低调灰', value: '#4B5563' }
];

const FONT_OPTIONS = [
  { value: 'font-sans', label: '现代黑体' },
  { value: 'font-serif', label: '雅致宋体' },
  { value: 'font-mono', label: '等宽代码' }
];

const fontFamilyModel = computed({
  get: () => resumeStore.themeConfig.fontFamily,
  set: (value: string) => {
    resumeStore.themeConfig.fontFamily = value;
  }
});

const showBorderModel = computed({
  get: () => resumeStore.themeConfig.showBorder,
  set: (value: boolean) => {
    resumeStore.themeConfig.showBorder = value;
  }
});

/**
 * 简历语言。
 *
 * 只影响文档呈现（模块标题、日期格式、分隔符），不翻译用户写的内容。
 * 选项文案用各语言的自称（中文 / English），切错语言也认得回来。
 */
const LOCALE_OPTIONS: Array<{ value: ResumeLocale; label: string; hint: string }> = [
  { value: 'zh-CN', label: '中文', hint: '2022.07 - 至今' },
  { value: 'en', label: 'English', hint: '07/2022 – Present' }
];

const localeModel = computed(() => resumeStore.locale);

function setLocale(value: ResumeLocale) {
  resumeStore.setLocale(value);
  toast.success(value === 'en' ? '简历已切换为英文' : '简历已切换为中文');
}
</script>

<template>
  <div class="space-y-6 text-xs text-slate-700">
    <!-- 简历语言 -->
    <div>
      <label class="block font-semibold text-slate-900 mb-1">简历语言</label>
      <p class="text-2xs text-slate-500 mb-2">
        决定模块标题与日期格式；不会翻译你写的内容
      </p>
      <div class="grid grid-cols-2 gap-2" role="group" aria-label="简历语言">
        <button
          v-for="option in LOCALE_OPTIONS"
          :key="option.value"
          type="button"
          class="px-2 py-1.5 rounded-lg border text-left transition"
          :class="
            localeModel === option.value
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          "
          :aria-pressed="localeModel === option.value"
          @click="setLocale(option.value)"
        >
          <span class="block text-xs font-bold">{{ option.label }}</span>
          <span class="block text-2xs font-mono text-slate-500 mt-0.5">{{ option.hint }}</span>
        </button>
      </div>
    </div>

    <hr class="border-slate-100" />

    <!-- 自动排版 -->
    <div class="p-3.5 rounded-xl bg-primary-50/70 border border-primary-100">
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold text-slate-900 flex items-center gap-1.5">
          <Sparkles class="w-4 h-4 text-primary-600" aria-hidden="true" />
          <span>自动排版</span>
        </span>
      </div>
      <p class="text-2xs text-slate-600 mb-2.5 leading-relaxed">
        按目标页数逐步调整段落间距、行高、字号与页边距，每一步都会重新测量排版。只改样式，不改内容。
      </p>

      <div class="flex items-center gap-1 mb-2.5" role="group" aria-label="目标页数">
        <button
          v-for="option in [1, 2]"
          :key="option"
          type="button"
          class="flex-1 px-2 py-1 rounded-md border text-2xs font-semibold transition"
          :class="
            targetPages === option
              ? 'bg-white border-primary-300 text-primary-700'
              : 'bg-transparent border-transparent text-slate-500 hover:bg-white/60'
          "
          :aria-pressed="targetPages === option"
          @click="targetPages = option as 1 | 2"
        >
          目标 {{ option }} 页
        </button>
      </div>

      <AppButton size="sm" block :loading="isAutoFitting" @click="triggerAutoFit">
        {{ isAutoFitting ? '正在计算…' : '立即调整' }}
      </AppButton>

      <AppButton
        v-if="resumeStore.canUndoAutoFit"
        size="sm"
        variant="ghost"
        block
        class="mt-1.5"
        @click="resumeStore.undoAutoFit()"
      >
        撤销本次自动排版
      </AppButton>
    </div>

    <!-- 主题色 -->
    <div>
      <label class="block font-semibold text-slate-900 mb-2">主题强调色</label>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="color in PRESET_COLORS"
          :key="color.value"
          type="button"
          class="h-8 rounded-lg flex items-center justify-center border border-slate-200 transition hover:scale-105"
          :style="{ backgroundColor: color.value }"
          :title="color.name"
          :aria-label="color.name"
          :aria-pressed="resumeStore.themeConfig.themeColor === color.value"
          @click="resumeStore.themeConfig.themeColor = color.value"
        >
          <Check
            v-if="resumeStore.themeConfig.themeColor === color.value"
            class="w-4 h-4 text-white"
            aria-hidden="true"
          />
        </button>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <label for="theme-color-custom" class="text-slate-600">自定义取色</label>
        <input
          id="theme-color-custom"
          v-model="resumeStore.themeConfig.themeColor"
          type="color"
          class="w-8 h-8 rounded border border-slate-200 cursor-pointer"
        />
        <span class="font-mono text-slate-500">{{ resumeStore.themeConfig.themeColor }}</span>
      </div>
    </div>

    <!-- 字体 -->
    <div>
      <label class="block font-semibold text-slate-900 mb-2">字体风格</label>
      <div class="grid grid-cols-3 gap-2" role="group" aria-label="字体风格">
        <button
          v-for="font in FONT_OPTIONS"
          :key="font.value"
          type="button"
          class="py-1.5 px-2 rounded-lg border text-xs text-center transition"
          :class="
            cx(
              font.value,
              fontFamilyModel === font.value
                ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            )
          "
          :aria-pressed="fontFamilyModel === font.value"
          @click="fontFamilyModel = font.value"
        >
          {{ font.label }}
        </button>
      </div>
    </div>

    <hr class="border-slate-100" />

    <!-- 数值滑块 -->
    <div>
      <div class="flex justify-between items-center mb-1">
        <label for="style-font-size" class="font-semibold text-slate-900">正文字号</label>
        <span class="font-mono text-primary-700 font-bold">{{ resumeStore.themeConfig.fontSize }}px</span>
      </div>
      <p class="text-2xs text-slate-500 mb-2">标题与小标题按比例阶梯自适应</p>
      <input
        id="style-font-size"
        v-model.number="resumeStore.themeConfig.fontSize"
        type="range"
        min="12"
        max="16"
        step="0.5"
        class="w-full accent-primary-600 cursor-pointer"
      />
    </div>

    <div>
      <div class="flex justify-between items-center mb-1">
        <label for="style-line-height" class="font-semibold text-slate-900">文本行高</label>
        <span class="font-mono text-primary-700 font-bold">{{ resumeStore.themeConfig.lineHeight }}</span>
      </div>
      <input
        id="style-line-height"
        v-model.number="resumeStore.themeConfig.lineHeight"
        type="range"
        min="1.3"
        max="1.8"
        step="0.05"
        class="w-full accent-primary-600 cursor-pointer"
      />
    </div>

    <div class="bg-primary-50/60 p-3 rounded-lg border border-primary-100">
      <div class="flex justify-between items-center mb-1">
        <label for="style-section-spacing" class="font-semibold text-slate-900">模块垂直间距</label>
        <span class="font-mono text-primary-700 font-bold">
          {{ resumeStore.themeConfig.sectionSpacing }}px
        </span>
      </div>
      <p class="text-slate-600 text-2xs mb-2">内容较少可调大填满整页，内容较多可调小收紧</p>
      <input
        id="style-section-spacing"
        v-model.number="resumeStore.themeConfig.sectionSpacing"
        type="range"
        min="8"
        max="32"
        step="1"
        class="w-full accent-primary-600 cursor-pointer"
      />
    </div>

    <div>
      <div class="flex justify-between items-center mb-1">
        <label for="style-paragraph-spacing" class="font-semibold text-slate-900">段落间距</label>
        <span class="font-mono text-primary-700 font-bold">
          {{ resumeStore.themeConfig.paragraphSpacing }}px
        </span>
      </div>
      <input
        id="style-paragraph-spacing"
        v-model.number="resumeStore.themeConfig.paragraphSpacing"
        type="range"
        min="2"
        max="16"
        step="1"
        class="w-full accent-primary-600 cursor-pointer"
      />
    </div>

    <div>
      <div class="flex justify-between items-center mb-1">
        <label for="style-page-padding" class="font-semibold text-slate-900">页面内边距</label>
        <span class="font-mono text-primary-700 font-bold">
          {{ resumeStore.themeConfig.pagePadding }}mm
        </span>
      </div>
      <input
        id="style-page-padding"
        v-model.number="resumeStore.themeConfig.pagePadding"
        type="range"
        min="12"
        max="26"
        step="1"
        class="w-full accent-primary-600 cursor-pointer"
      />
    </div>

    <AppSwitch
      v-model="showBorderModel"
      label="展示模块下划线"
      description="关闭后各模块之间只保留留白"
    />
  </div>
</template>
