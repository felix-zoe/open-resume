<script setup lang="ts">
import { ref } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { ResumeModules } from '../../types/resume';
import SectionProfile from './SectionProfile.vue';
import SectionWork from './SectionWork.vue';
import SectionProjects from './SectionProjects.vue';
import SectionSkills from './SectionSkills.vue';
import SectionEducation from './SectionEducation.vue';
import SectionCustom from './SectionCustom.vue';
import {
  User,
  Briefcase,
  FolderGit2,
  Cpu,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';

const resumeStore = useResumeStore();

// 记录展开折叠状态
const openSections = ref<Record<string, boolean>>({
  profile: true,
  work: true,
  projects: true,
  skills: true,
  education: true,
  custom: false
});

const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key];
};

// 模块图标映射
const getModuleIcon = (key: string) => {
  switch (key) {
    case 'work': return Briefcase;
    case 'projects': return FolderGit2;
    case 'skills': return Cpu;
    case 'education': return GraduationCap;
    case 'custom': return Sparkles;
    default: return User;
  }
};

// 模块中文名称映射
const getModuleName = (key: keyof ResumeModules) => {
  return resumeStore.content.modules[key]?.title || '模块';
};

// 模块上下移动换序
const moveModule = (index: number, direction: 'up' | 'down') => {
  const order = [...resumeStore.content.modulesOrder];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex >= 0 && targetIndex < order.length) {
    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;
    resumeStore.content.modulesOrder = order;
  }
};
</script>

<template>
  <aside class="w-full lg:w-[480px] xl:w-[520px] bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-3.5rem)] overflow-y-auto no-print">
    <div class="p-4 sm:p-5 space-y-3.5">
      <!-- 1. 固定的基本信息卡片 (不可移动顺序) -->
      <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
        <div
          @click="toggleSection('profile')"
          class="px-4 py-3 bg-gray-50/80 hover:bg-gray-100 flex items-center justify-between cursor-pointer transition select-none"
        >
          <div class="flex items-center gap-2 font-semibold text-xs text-gray-800">
            <User class="w-4 h-4 text-blue-600" />
            <span>基本信息</span>
          </div>
          <component :is="openSections.profile ? ChevronUp : ChevronDown" class="w-4 h-4 text-gray-400" />
        </div>
        <div v-show="openSections.profile" class="p-4 border-t border-gray-100 bg-white">
          <SectionProfile />
        </div>
      </div>

      <!-- 2. 动态模块卡片流 (支持上下移动换序、显隐开关) -->
      <div
        v-for="(modKey, index) in resumeStore.content.modulesOrder"
        :key="modKey"
        class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white transition"
      >
        <div class="px-4 py-3 bg-gray-50/80 hover:bg-gray-100 flex items-center justify-between transition select-none">
          <!-- 模块标题与图标 -->
          <div
            @click="toggleSection(modKey)"
            class="flex items-center gap-2 font-semibold text-xs text-gray-800 cursor-pointer flex-1"
          >
            <component :is="getModuleIcon(modKey)" class="w-4 h-4 text-blue-600" />
            <span>{{ getModuleName(modKey) }}</span>
            <span v-if="!resumeStore.content.modules[modKey].visible" class="text-[10px] text-gray-400 font-normal">
              (已隐藏)
            </span>
          </div>

          <!-- 右侧操作栏：上下移动、显隐、展开折叠 -->
          <div class="flex items-center gap-1">
            <!-- 向上移动 -->
            <button
              @click.stop="moveModule(index, 'up')"
              :disabled="index === 0"
              class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded"
              title="上移此模块"
            >
              <ArrowUp class="w-3.5 h-3.5" />
            </button>

            <!-- 向下移动 -->
            <button
              @click.stop="moveModule(index, 'down')"
              :disabled="index === resumeStore.content.modulesOrder.length - 1"
              class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded"
              title="下移此模块"
            >
              <ArrowDown class="w-3.5 h-3.5" />
            </button>

            <!-- 显隐开关 -->
            <button
              @click.stop="resumeStore.content.modules[modKey].visible = !resumeStore.content.modules[modKey].visible"
              class="p-1 text-gray-400 hover:text-gray-700 rounded ml-1"
              :title="resumeStore.content.modules[modKey].visible ? '在简历上隐藏此模块' : '显示此模块'"
            >
              <component :is="resumeStore.content.modules[modKey].visible ? Eye : EyeOff" class="w-3.5 h-3.5" />
            </button>

            <!-- 展开/折叠 -->
            <button @click="toggleSection(modKey)" class="p-1 text-gray-400 hover:text-gray-700 rounded">
              <component :is="openSections[modKey] ? ChevronUp : ChevronDown" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 卡片展开正文 -->
        <div v-show="openSections[modKey]" class="p-4 border-t border-gray-100 bg-white">
          <SectionWork v-if="modKey === 'work'" />
          <SectionProjects v-else-if="modKey === 'projects'" />
          <SectionSkills v-else-if="modKey === 'skills'" />
          <SectionEducation v-else-if="modKey === 'education'" />
          <SectionCustom v-else-if="modKey === 'custom'" />
        </div>
      </div>
    </div>
  </aside>
</template>
