<script setup lang="ts">
import { useResumeStore } from '../stores/resume';
import { X, Check } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const resumeStore = useResumeStore();

const TEMPLATES = [
  {
    id: 'classic',
    name: '经典通用型 (Classic)',
    tag: 'HR 首选',
    description: '标准黑白排版与强调色点缀，居中对称，适合绝大多数行业及社招/校招',
    bgColor: 'bg-blue-50'
  },
  {
    id: 'geek',
    name: '极简极客型 (Geek)',
    tag: '研发推荐',
    description: '科技感等宽字体标识，弱化多余边线，强化技术栈标签与代码主页链接',
    bgColor: 'bg-emerald-50'
  },
  {
    id: 'modern',
    name: '现代双栏型 (Modern Sidebar)',
    tag: '视觉突出',
    description: '左侧深色侧栏展示基础技能，右侧主栏聚焦经历与项目，视觉层次鲜明',
    bgColor: 'bg-purple-50'
  }
];

const selectTemplate = (id: string) => {
  resumeStore.templateId = id;
  emit('close');
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto no-print flex items-center justify-center p-4">
    <div @click="emit('close')" class="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"></div>

    <div class="relative bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl z-10">
      <div class="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h3 class="text-base font-bold text-gray-900">选择简历排版模板</h3>
          <p class="text-xs text-gray-500 mt-0.5">切换模板不会丢失或改变您的任何简历内容</p>
        </div>
        <button @click="emit('close')" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- 模板卡片列表 -->
      <div class="grid grid-cols-1 gap-3.5 mt-5">
        <div
          v-for="tpl in TEMPLATES"
          :key="tpl.id"
          @click="selectTemplate(tpl.id)"
          class="p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-4 hover:border-blue-500 hover:shadow-md"
          :class="resumeStore.templateId === tpl.id ? 'border-blue-600 bg-blue-50/30' : 'border-gray-200 bg-white'"
        >
          <!-- 示意图标块 -->
          <div class="w-12 h-16 rounded border border-gray-300 flex-shrink-0 flex flex-col p-1 gap-1 shadow-2xs" :class="tpl.bgColor">
            <div class="h-1.5 bg-gray-400/60 rounded-xs w-3/4 mx-auto"></div>
            <div class="h-1 bg-gray-300/60 rounded-xs w-full"></div>
            <div class="h-1 bg-gray-300/60 rounded-xs w-5/6"></div>
            <div class="h-1 bg-gray-300/60 rounded-xs w-4/5"></div>
          </div>

          <div class="flex-1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-bold text-gray-900">{{ tpl.name }}</h4>
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{{ tpl.tag }}</span>
              </div>
              <div v-if="resumeStore.templateId === tpl.id" class="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Check class="w-3 h-3" />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1 leading-relaxed">
              {{ tpl.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
