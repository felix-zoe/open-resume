<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { Mail, Phone, MapPin, Globe, Github, Briefcase } from 'lucide-vue-next';

const props = defineProps<{
  content: ResumeContent;
  theme: ThemeConfig;
}>();

const { profile, modules, modulesOrder } = props.content;

// 动态样式计算
const containerStyle = computed(() => ({
  fontSize: `${props.theme.fontSize}px`,
  lineHeight: props.theme.lineHeight,
  padding: `${props.theme.pagePadding}mm`
}));

const sectionMarginStyle = computed(() => ({
  marginBottom: `${props.theme.sectionSpacing}px`
}));

const paragraphMarginStyle = computed(() => ({
  marginBottom: `${props.theme.paragraphSpacing}px`
}));
</script>

<template>
  <div class="classic-template w-full bg-white text-gray-800" :class="theme.fontFamily" :style="containerStyle">
    <!-- 1. 顶部基础信息 (居中/左右排布) -->
    <header class="flex items-center justify-between border-b pb-4 mb-5" :style="{ borderColor: theme.showBorder ? '#e5e7eb' : 'transparent' }">
      <div class="flex-1">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900" :style="{ color: theme.themeColor }">
          {{ profile.name || '姓名' }}
        </h1>
        <p class="text-base font-medium text-gray-600 mt-1">
          {{ profile.title || '求职意向' }}
        </p>

        <!-- 联系方式徽标组 -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
          <span v-if="profile.phone" class="inline-flex items-center gap-1">
            <Phone class="w-3.5 h-3.5 text-gray-400" /> {{ profile.phone }}
          </span>
          <span v-if="profile.email" class="inline-flex items-center gap-1">
            <Mail class="w-3.5 h-3.5 text-gray-400" /> {{ profile.email }}
          </span>
          <span v-if="profile.location" class="inline-flex items-center gap-1">
            <MapPin class="w-3.5 h-3.5 text-gray-400" /> {{ profile.location }}
          </span>
          <span v-if="profile.workYears" class="inline-flex items-center gap-1">
            <Briefcase class="w-3.5 h-3.5 text-gray-400" /> {{ profile.workYears }}
          </span>
          <span v-if="profile.salaryExpectation" class="inline-flex items-center gap-1 text-emerald-600 font-medium">
            💰 {{ profile.salaryExpectation }}
          </span>
          <a v-if="profile.github" :href="profile.github" target="_blank" class="inline-flex items-center gap-1 hover:underline text-blue-600">
            <Github class="w-3.5 h-3.5" /> GitHub
          </a>
          <a v-if="profile.website" :href="profile.website" target="_blank" class="inline-flex items-center gap-1 hover:underline text-blue-600">
            <Globe class="w-3.5 h-3.5" /> 作品集
          </a>
        </div>

        <p v-if="profile.summary" class="text-xs text-gray-500 mt-2 leading-relaxed">
          {{ profile.summary }}
        </p>
      </div>

      <!-- 头像 -->
      <div v-if="profile.showAvatar && profile.avatar" class="ml-4 flex-shrink-0">
        <img :src="profile.avatar" alt="Avatar" class="w-20 h-24 object-cover rounded border border-gray-200 shadow-sm" />
      </div>
    </header>

    <!-- 2. 动态模块排版 (按用户自定义顺序渲染) -->
    <div class="resume-body">
      <template v-for="modKey in modulesOrder" :key="modKey">
        <!-- 工作经历模块 -->
        <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" :style="sectionMarginStyle">
          <h2 class="section-title text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b flex items-center gap-2"
              :style="{ color: theme.themeColor, borderColor: theme.showBorder ? theme.themeColor : 'transparent' }">
            <span>{{ modules.work.title }}</span>
          </h2>
          <div class="space-y-3">
            <div v-for="item in modules.work.items" :key="item.id" class="resume-section-item">
              <div class="flex justify-between items-baseline font-semibold text-gray-900">
                <span>{{ item.company }} <span v-if="item.department" class="text-xs font-normal text-gray-500">({{ item.department }})</span></span>
                <span class="text-xs text-gray-500">{{ item.startDate }} - {{ item.endDate }}</span>
              </div>
              <div class="text-xs font-medium text-gray-700 mb-1" :style="{ color: theme.themeColor }">
                {{ item.position }}
              </div>
              <div class="text-xs text-gray-600 whitespace-pre-line leading-relaxed" :style="paragraphMarginStyle">
                {{ item.description }}
              </div>
            </div>
          </div>
        </section>

        <!-- 项目经历模块 -->
        <section v-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" :style="sectionMarginStyle">
          <h2 class="section-title text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b flex items-center gap-2"
              :style="{ color: theme.themeColor, borderColor: theme.showBorder ? theme.themeColor : 'transparent' }">
            <span>{{ modules.projects.title }}</span>
          </h2>
          <div class="space-y-3">
            <div v-for="item in modules.projects.items" :key="item.id" class="resume-section-item">
              <div class="flex justify-between items-baseline font-semibold text-gray-900">
                <span class="flex items-center gap-2">
                  {{ item.name }}
                  <span v-if="item.role" class="text-xs font-normal text-gray-600">· {{ item.role }}</span>
                  <a v-if="item.link" :href="item.link" target="_blank" class="text-xs text-blue-500 hover:underline">🔗 演示链接</a>
                </span>
                <span class="text-xs text-gray-500">{{ item.startDate }} - {{ item.endDate }}</span>
              </div>
              <div class="text-xs text-gray-600 whitespace-pre-line leading-relaxed mt-1" :style="paragraphMarginStyle">
                {{ item.description }}
              </div>
            </div>
          </div>
        </section>

        <!-- 专业技能模块 -->
        <section v-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length" :style="sectionMarginStyle">
          <h2 class="section-title text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b flex items-center gap-2"
              :style="{ color: theme.themeColor, borderColor: theme.showBorder ? theme.themeColor : 'transparent' }">
            <span>{{ modules.skills.title }}</span>
          </h2>
          <ul class="list-disc list-inside text-xs text-gray-600 space-y-1.5 leading-relaxed">
            <li v-for="(skill, idx) in modules.skills.items" :key="idx" class="resume-section-item">
              {{ skill }}
            </li>
          </ul>
        </section>

        <!-- 教育背景模块 -->
        <section v-if="modKey === 'education' && modules.education.visible && modules.education.items.length" :style="sectionMarginStyle">
          <h2 class="section-title text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b flex items-center gap-2"
              :style="{ color: theme.themeColor, borderColor: theme.showBorder ? theme.themeColor : 'transparent' }">
            <span>{{ modules.education.title }}</span>
          </h2>
          <div class="space-y-2">
            <div v-for="item in modules.education.items" :key="item.id" class="resume-section-item flex justify-between items-start">
              <div>
                <span class="font-semibold text-gray-900 text-xs">{{ item.school }}</span>
                <span class="text-xs text-gray-600 ml-2">· {{ item.major }}</span>
                <span class="text-xs text-gray-500 ml-2">({{ item.degree }})</span>
                <p v-if="item.description" class="text-xs text-gray-500 mt-0.5">{{ item.description }}</p>
              </div>
              <span class="text-xs text-gray-500">{{ item.startDate }} - {{ item.endDate }}</span>
            </div>
          </div>
        </section>

        <!-- 自定义模块 -->
        <section v-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" :style="sectionMarginStyle">
          <h2 class="section-title text-sm font-bold uppercase tracking-wider pb-1 mb-2 border-b flex items-center gap-2"
              :style="{ color: theme.themeColor, borderColor: theme.showBorder ? theme.themeColor : 'transparent' }">
            <span>{{ modules.custom.title }}</span>
          </h2>
          <ul class="list-disc list-inside text-xs text-gray-600 space-y-1 leading-relaxed">
            <li v-for="(item, idx) in modules.custom.items" :key="idx" class="resume-section-item">
              {{ item }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
