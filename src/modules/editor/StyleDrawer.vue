<script setup lang="ts">
import { computed } from 'vue';
import { Check, Sparkles } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { AppButton, AppDrawer, AppSwitch } from '../../components/ui';
import { useToast } from '../../composables/useToast';
import { cx } from '../../components/ui/utils';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const resumeStore = useResumeStore();
const toast = useToast();

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});

const triggerAutoFit = () => {
  const result = resumeStore.autoFitOnePage();
  if (result.success) {
    toast.success(result.message);
  } else {
    toast.error(result.message);
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
</script>

<template>
  <AppDrawer v-model:open="open" title="排版与样式调优" width-class="w-full max-w-sm">
    <div class="space-y-6 text-xs text-slate-700">
      <!-- 一键卡页 -->
      <div class="p-3.5 rounded-xl bg-primary-50/70 border border-primary-100">
        <div class="flex items-center justify-between mb-1.5">
          <span class="font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles class="w-4 h-4 text-primary-600" aria-hidden="true" />
            <span>一键收敛到单页</span>
          </span>
        </div>
        <p class="text-2xs text-slate-600 mb-2.5 leading-relaxed">
          自动收紧行高、段落与模块间距，把内容压到一页 A4。字号与内容不会改变。
        </p>
        <AppButton size="sm" block @click="triggerAutoFit">立即调整</AppButton>
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

    <template #footer>
      <AppButton block @click="emit('close')">完成并应用</AppButton>
    </template>
  </AppDrawer>
</template>
