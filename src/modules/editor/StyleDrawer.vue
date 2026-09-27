<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { X, Check } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const resumeStore = useResumeStore();

// 预设主题色系
const PRESET_COLORS = [
  { name: '科技商务蓝', value: '#2563EB' },
  { name: '曜石深邃黑', value: '#1E293B' },
  { name: '远峰雅致青', value: '#0D9488' },
  { name: '沉稳翡翠绿', value: '#059669' },
  { name: '经典故宫红', value: '#DC2626' },
  { name: '优雅梦幻紫', value: '#7C3AED' },
  { name: '琥珀暖阳橙', value: '#D97706' },
  { name: '钛金低调灰', value: '#4B5563' },
];
</script>

<template>
  <!-- 侧边滑出抽屉 -->
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden no-print">
    <!-- 遮罩背景 -->
    <div @click="emit('close')" class="absolute inset-0 bg-black/20 backdrop-blur-2xs transition-opacity"></div>

    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-sm bg-white shadow-2xl flex flex-col">
        <!-- 抽屉头部 -->
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-sm font-bold text-gray-800">排版与样式调优</h2>
          <button @click="emit('close')" class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- 设置项表单 -->
        <div class="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-gray-700">
          <!-- 1. 主题强调色 -->
          <div>
            <label class="block font-semibold text-gray-900 mb-2">主题强调色</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="color in PRESET_COLORS"
                :key="color.value"
                @click="resumeStore.themeConfig.themeColor = color.value"
                class="h-8 rounded-lg flex items-center justify-center border transition relative"
                :style="{ backgroundColor: color.value }"
                :title="color.name"
              >
                <Check v-if="resumeStore.themeConfig.themeColor === color.value" class="w-4 h-4 text-white" />
              </button>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <span class="text-gray-500">自定义取色：</span>
              <input
                type="color"
                v-model="resumeStore.themeConfig.themeColor"
                class="w-8 h-8 rounded border border-gray-200 cursor-pointer"
              />
              <span class="font-mono text-gray-400">{{ resumeStore.themeConfig.themeColor }}</span>
            </div>
          </div>

          <!-- 1.1 字体栈选择 -->
          <div>
            <label class="block font-semibold text-gray-900 mb-2">字体风格</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="resumeStore.themeConfig.fontFamily = 'font-sans'"
                class="py-1.5 px-2 rounded-lg border text-xs text-center transition font-sans"
                :class="resumeStore.themeConfig.fontFamily === 'font-sans' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                现代黑体
              </button>
              <button
                @click="resumeStore.themeConfig.fontFamily = 'font-serif'"
                class="py-1.5 px-2 rounded-lg border text-xs text-center transition font-serif"
                :class="resumeStore.themeConfig.fontFamily === 'font-serif' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                雅致宋体
              </button>
              <button
                @click="resumeStore.themeConfig.fontFamily = 'font-mono'"
                class="py-1.5 px-2 rounded-lg border text-xs text-center transition font-mono"
                :class="resumeStore.themeConfig.fontFamily === 'font-mono' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
              >
                等宽代码
              </button>
            </div>
          </div>

          <hr class="border-gray-100" />

          <!-- 2. 基准字号 (px) -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="font-semibold text-gray-900">正文字号</label>
              <span class="font-mono text-blue-600 font-bold">{{ resumeStore.themeConfig.fontSize }}px</span>
            </div>
            <p class="text-gray-400 mb-2">标题与小标题将依比例阶梯自适应</p>
            <input
              type="range"
              min="12"
              max="16"
              step="0.5"
              v-model.number="resumeStore.themeConfig.fontSize"
              class="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <!-- 3. 行高比例 -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="font-semibold text-gray-900">文本行高</label>
              <span class="font-mono text-blue-600 font-bold">{{ resumeStore.themeConfig.lineHeight }}</span>
            </div>
            <input
              type="range"
              min="1.3"
              max="1.8"
              step="0.05"
              v-model.number="resumeStore.themeConfig.lineHeight"
              class="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <!-- 4. 模块垂直外间距 (核心一页纸调节) -->
          <div class="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
            <div class="flex justify-between items-center mb-1">
              <label class="font-semibold text-blue-950 flex items-center gap-1">
                <span>模块垂直间距</span>
                <span class="bg-blue-600 text-white text-[9px] px-1 py-0.2 rounded font-normal">单页微调神器</span>
              </label>
              <span class="font-mono text-blue-600 font-bold">{{ resumeStore.themeConfig.sectionSpacing }}px</span>
            </div>
            <p class="text-gray-500 text-[11px] mb-2">经历较少可拉大填满单页，经历较多可调小收紧防超页</p>
            <input
              type="range"
              min="8"
              max="32"
              step="1"
              v-model.number="resumeStore.themeConfig.sectionSpacing"
              class="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <!-- 5. 段落间距 -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="font-semibold text-gray-900">段落间距</label>
              <span class="font-mono text-blue-600 font-bold">{{ resumeStore.themeConfig.paragraphSpacing }}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              v-model.number="resumeStore.themeConfig.paragraphSpacing"
              class="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <!-- 6. 画布页面边距 (mm) -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="font-semibold text-gray-900">页面内边距 (Padding)</label>
              <span class="font-mono text-blue-600 font-bold">{{ resumeStore.themeConfig.pagePadding }}mm</span>
            </div>
            <input
              type="range"
              min="12"
              max="26"
              step="1"
              v-model.number="resumeStore.themeConfig.pagePadding"
              class="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <!-- 7. 模块分割线下划线 -->
          <div class="flex items-center justify-between pt-2">
            <span class="font-semibold text-gray-900">展示模块下划线</span>
            <input
              type="checkbox"
              v-model="resumeStore.themeConfig.showBorder"
              class="w-4 h-4 text-blue-600 rounded accent-blue-600 cursor-pointer"
            />
          </div>
        </div>

        <!-- 底部确定按钮 -->
        <div class="p-4 border-t border-gray-100 bg-gray-50">
          <button
            @click="emit('close')"
            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition"
          >
            完成并应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
