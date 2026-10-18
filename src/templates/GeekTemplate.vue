<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { safeUrl } from '../utils/url';
import { Terminal, ExternalLink } from 'lucide-vue-next';

const props = defineProps<{
  content: ResumeContent;
  theme: ThemeConfig;
}>();

const profile = computed(() => props.content.profile);
const modules = computed(() => props.content.modules);
const modulesOrder = computed(() => props.content.modulesOrder || ['skills', 'work', 'projects', 'education', 'custom']);

// 用户输入的外链必须先校验协议，避免 javascript: 在公开分享页执行
const githubUrl = computed(() => safeUrl(profile.value.github));
const websiteUrl = computed(() => safeUrl(profile.value.website));

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
  <div class="geek-template resume-doc w-full bg-white text-slate-800" :class="theme.fontFamily || 'font-mono'" :style="containerStyle">
    <!-- 极客风头部 -->
    <div class="resume-header border-l-4 pl-4 py-1 mb-5" :style="{ borderColor: theme.themeColor }">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Terminal class="w-6 h-6 inline-block" :style="{ color: theme.themeColor }" />
            {{ profile.name || '姓名' }}
          </h1>
          <p class="text-sm font-semibold text-slate-600 mt-0.5">
            {{ profile.title || '求职意向' }}
          </p>
        </div>
        <div v-if="profile.showAvatar && profile.avatar" class="ml-4">
          <img :src="profile.avatar" alt="Avatar" class="w-16 h-16 rounded-full object-cover border-2" :style="{ borderColor: theme.themeColor }" />
        </div>
      </div>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 font-sans">
        <span v-if="profile.phone">📱 {{ profile.phone }}</span>
        <span v-if="profile.email">✉️ {{ profile.email }}</span>
        <span v-if="profile.location">📍 {{ profile.location }}</span>
        <span v-if="profile.workYears">💼 {{ profile.workYears }}</span>
        <span v-if="profile.salaryExpectation" class="text-emerald-700">💰 {{ profile.salaryExpectation }}</span>
        <a v-if="githubUrl" :href="githubUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-0.5 text-slate-700 underline">
          <span>GitHub</span> <ExternalLink class="w-3 h-3" />
        </a>
        <a v-if="websiteUrl" :href="websiteUrl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-0.5 text-slate-700 underline">
          <span>Blog</span> <ExternalLink class="w-3 h-3" />
        </a>
      </div>

      <p v-if="profile.summary" class="text-xs text-slate-600 font-sans mt-2">
        // {{ profile.summary }}
      </p>
    </div>

    <!-- 动态模块 -->
    <div class="geek-body font-sans">
      <template v-for="modKey in modulesOrder" :key="modKey">
        <!-- 技能模块置前或按序 -->
        <section v-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length" :style="sectionMarginStyle">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: theme.themeColor }"></span>
            # SKILLS & STACK
          </h2>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span v-for="(skill, idx) in modules.skills.items" :key="idx"
                  class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
              {{ skill }}
            </span>
          </div>
        </section>

        <!-- 工作经历 -->
        <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" :style="sectionMarginStyle">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: theme.themeColor }"></span>
            # EXPERIENCE
          </h2>
          <div class="space-y-3">
            <div v-for="item in modules.work.items" :key="item.id" class="resume-section-item">
              <div class="flex justify-between items-baseline">
                <span class="font-bold text-slate-900 text-xs">{{ item.company }} <span class="font-normal text-slate-500">/ {{ item.position }}</span></span>
                <span class="text-xs font-mono text-slate-500">{{ item.startDate }} ~ {{ item.endDate }}</span>
              </div>
              <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed mt-1" :style="paragraphMarginStyle">
                {{ item.description }}
              </p>
            </div>
          </div>
        </section>

        <!-- 项目经历 -->
        <section v-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" :style="sectionMarginStyle">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: theme.themeColor }"></span>
            # PROJECTS
          </h2>
          <div class="space-y-3">
            <div v-for="item in modules.projects.items" :key="item.id" class="resume-section-item">
              <div class="flex justify-between items-baseline">
                <span class="font-bold text-slate-900 text-xs">
                  {{ item.name }}
                  <span v-if="item.role" class="text-xs font-normal text-slate-500">({{ item.role }})</span>
                </span>
                <span class="text-xs font-mono text-slate-500">{{ item.startDate }} ~ {{ item.endDate }}</span>
              </div>
              <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed mt-1" :style="paragraphMarginStyle">
                {{ item.description }}
              </p>
            </div>
          </div>
        </section>

        <!-- 教育背景 -->
        <section v-if="modKey === 'education' && modules.education.visible && modules.education.items.length" :style="sectionMarginStyle">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: theme.themeColor }"></span>
            # EDUCATION
          </h2>
          <div class="space-y-1.5">
            <div v-for="item in modules.education.items" :key="item.id" class="resume-section-item flex justify-between text-xs">
              <span><strong>{{ item.school }}</strong> · {{ item.major }} ({{ item.degree }})</span>
              <span class="font-mono text-slate-500">{{ item.startDate }} ~ {{ item.endDate }}</span>
            </div>
          </div>
        </section>

        <!-- 自定义模块 -->
        <section v-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" :style="sectionMarginStyle">
          <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :style="{ background: theme.themeColor }"></span>
            # {{ modules.custom.title.toUpperCase() }}
          </h2>
          <ul class="list-disc list-inside text-xs text-slate-600 space-y-1">
            <li v-for="(item, idx) in modules.custom.items" :key="idx" class="resume-section-item">
              {{ item }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
