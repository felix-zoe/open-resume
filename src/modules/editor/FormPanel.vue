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
import ModuleManagerDrawer from '../../components/editor/ModuleManagerDrawer.vue';
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
  SlidersHorizontal
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

const isModuleManagerOpen = ref(false);

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
</script>

<template>
  <aside class="w-full lg:w-[420px] xl:w-[480px] bg-white border-r border-slate-200 flex flex-col h-full min-h-0 overflow-y-auto no-print">
    <div class="p-4 sm:p-5 space-y-3.5">
      <!-- 1. 固定的基本信息卡片 (不可移动顺序) -->
      <div class="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
        <div
          @click="toggleSection('profile')"
          class="px-4 py-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition select-none"
        >
          <div class="flex items-center gap-2 font-semibold text-xs text-slate-800">
            <User class="w-4 h-4 text-primary-600" />
            <span>基本信息</span>
          </div>
          <component :is="openSections.profile ? ChevronUp : ChevronDown" class="w-4 h-4 text-slate-400" />
        </div>
        <div v-show="openSections.profile" class="p-4 border-t border-slate-100 bg-white">
          <SectionProfile />
        </div>
      </div>

      <!-- 2. 模块管理入口：排序与显隐集中在抽屉里，卡片头只保留展开与显隐 -->
      <button
        type="button"
        class="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50/40 text-slate-600 hover:text-primary-700 transition"
        @click="isModuleManagerOpen = true"
      >
        <span class="flex items-center gap-2 text-xs font-semibold">
          <SlidersHorizontal class="w-3.5 h-3.5" aria-hidden="true" />
          <span>管理模块顺序与显隐</span>
        </span>
        <span class="text-2xs text-slate-500">拖拽排序</span>
      </button>

      <!-- 3. 动态模块卡片流 -->
      <div
        v-for="modKey in resumeStore.content.modulesOrder"
        :key="modKey"
        class="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white transition"
      >
        <div class="px-4 py-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between transition select-none">
          <!-- 模块标题与图标 -->
          <div
            @click="toggleSection(modKey)"
            class="flex items-center gap-2 font-semibold text-xs text-slate-800 cursor-pointer flex-1"
          >
            <component :is="getModuleIcon(modKey)" class="w-4 h-4 text-primary-600" />
            <span>{{ getModuleName(modKey) }}</span>
            <span v-if="!resumeStore.content.modules[modKey].visible" class="text-2xs text-slate-500 font-normal">
              (已隐藏)
            </span>
          </div>

          <!-- 右侧操作栏：显隐、展开折叠 -->
          <div class="flex items-center gap-1">
            <button
              @click.stop="resumeStore.content.modules[modKey].visible = !resumeStore.content.modules[modKey].visible"
              class="p-1 text-slate-500 hover:text-slate-800 rounded ml-1"
              :aria-label="resumeStore.content.modules[modKey].visible ? '在简历上隐藏此模块' : '显示此模块'"
              :aria-pressed="resumeStore.content.modules[modKey].visible"
              :title="resumeStore.content.modules[modKey].visible ? '在简历上隐藏此模块' : '显示此模块'"
            >
              <component :is="resumeStore.content.modules[modKey].visible ? Eye : EyeOff" class="w-3.5 h-3.5" />
            </button>

            <button
              @click="toggleSection(modKey)"
              class="p-1 text-slate-500 hover:text-slate-800 rounded"
              :aria-expanded="!!openSections[modKey]"
              :aria-label="openSections[modKey] ? '收起此模块' : '展开此模块'"
            >
              <component :is="openSections[modKey] ? ChevronUp : ChevronDown" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 卡片展开正文 -->
        <div v-show="openSections[modKey]" class="p-4 border-t border-slate-100 bg-white">
          <SectionWork v-if="modKey === 'work'" />
          <SectionProjects v-else-if="modKey === 'projects'" />
          <SectionSkills v-else-if="modKey === 'skills'" />
          <SectionEducation v-else-if="modKey === 'education'" />
          <SectionCustom v-else-if="modKey === 'custom'" />
        </div>
      </div>
    </div>

    <ModuleManagerDrawer v-model:open="isModuleManagerOpen" />
  </aside>
</template>
