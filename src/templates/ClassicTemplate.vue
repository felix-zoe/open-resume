<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { safeUrl } from '../utils/url';
import { Mail, Phone, MapPin, Globe, Github, Briefcase, Wallet } from 'lucide-vue-next';
import { buildDocStyle, showSalaryOf } from './theme';
import {
  formatDateRange,
  getLabels,
  resolveModuleTitle,
  wrapParen
} from '../i18n/resumeLabels';

const props = defineProps<{
  content: ResumeContent;
  theme: ThemeConfig;
}>();

const profile = computed(() => props.content.profile);
const modules = computed(() => props.content.modules);
const modulesOrder = computed(() => props.content.modulesOrder || ['work', 'projects', 'skills', 'education', 'custom']);

// 用户输入的外链必须先校验协议，避免 javascript: 在公开分享页执行
const githubUrl = computed(() => safeUrl(profile.value.github));
const websiteUrl = computed(() => safeUrl(profile.value.website));
const showSalary = computed(() => showSalaryOf(props.theme, profile.value));

// 所有尺寸都由 CSS 变量 + em 驱动，改字号即全量等比例缩放
const docStyle = computed(() => buildDocStyle(props.theme));

// 简历语言只影响文档呈现（标题/日期/分隔符），不碰用户输入的内容
const locale = computed(() => props.content.locale);
const labels = computed(() => getLabels(locale.value));
const titleOf = (key: Parameters<typeof resolveModuleTitle>[0], fallback?: string) =>
  resolveModuleTitle(key, fallback, locale.value);

/** 技能形态（TPL-04）：缺省按整句列出，用户切成标签时改成胶囊 */
const isTagSkills = computed(() => modules.value.skills.type === 'tag');
</script>

<template>
  <div class="classic-template resume-doc w-full bg-white" :class="theme.fontFamily" :style="docStyle">
    <!-- 1. 顶部基础信息 -->
    <div
      class="resume-header flex items-start justify-between pb-4 mb-5"
      :style="{ borderBottom: `1px solid ${theme.showBorder ? 'var(--rs-border)' : 'transparent'}` }"
    >
      <div class="flex-1 min-w-0">
        <h1 class="rs-name">{{ profile.name || labels.name }}</h1>
        <p class="rs-job-title mt-1">{{ profile.title || labels.jobTitle }}</p>

        <!-- 联系方式 -->
        <div class="rs-contact flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          <span v-if="profile.phone" class="inline-flex items-center gap-1">
            <Phone class="rs-icon" /> {{ profile.phone }}
          </span>
          <span v-if="profile.email" class="inline-flex items-center gap-1">
            <Mail class="rs-icon" /> {{ profile.email }}
          </span>
          <span v-if="profile.location" class="inline-flex items-center gap-1">
            <MapPin class="rs-icon" /> {{ profile.location }}
          </span>
          <span v-if="profile.workYears" class="inline-flex items-center gap-1">
            <Briefcase class="rs-icon" /> {{ profile.workYears }}
          </span>
          <span v-if="showSalary" class="inline-flex items-center gap-1">
            <Wallet class="rs-icon" /> {{ profile.salaryExpectation }}
          </span>
          <a v-if="githubUrl" :href="githubUrl" target="_blank" rel="noopener noreferrer" class="rs-link inline-flex items-center gap-1">
            <Github class="rs-icon" /> GitHub
          </a>
          <a v-if="websiteUrl" :href="websiteUrl" target="_blank" rel="noopener noreferrer" class="rs-link inline-flex items-center gap-1">
            <Globe class="rs-icon" /> {{ labels.portfolio }}
          </a>
        </div>

        <p v-if="profile.summary" class="rs-summary mt-2">{{ profile.summary }}</p>
      </div>

      <!-- 头像 -->
      <div v-if="profile.showAvatar && profile.avatar" class="ml-4 flex-shrink-0">
        <img
          :src="profile.avatar"
          alt=""
          loading="lazy"
          width="100"
          height="120"
          class="object-cover border border-slate-200"
          style="width: 5em; height: 6em"
        />
      </div>
    </div>

    <!-- 2. 动态模块（按 modulesOrder 渲染） -->
    <div class="resume-body">
      <template v-for="modKey in modulesOrder" :key="modKey">
        <!-- 工作经历 -->
        <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" class="rs-section">
          <h2 class="rs-section-title" :class="{ 'rs-section-title--plain': !theme.showBorder }">
            {{ titleOf('work', modules.work.title) }}
          </h2>
          <div class="flex flex-col gap-3">
            <div v-for="item in modules.work.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title">
                  {{ item.company }}
                  <span v-if="item.department" class="rs-meta font-normal">{{ wrapParen(item.department, locale) }}</span>
                </span>
                <span class="rs-meta whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <div class="rs-meta font-medium" :style="{ color: 'var(--rs-color)' }">{{ item.position }}</div>
              <div class="rs-body mt-0.5">{{ item.description }}</div>
            </div>
          </div>
        </section>

        <!-- 项目经历 -->
        <section v-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" class="rs-section">
          <h2 class="rs-section-title" :class="{ 'rs-section-title--plain': !theme.showBorder }">
            {{ titleOf('projects', modules.projects.title) }}
          </h2>
          <div class="flex flex-col gap-3">
            <div v-for="item in modules.projects.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title flex items-center gap-2 flex-wrap">
                  {{ item.name }}
                  <span v-if="item.role" class="rs-meta font-normal">· {{ item.role }}</span>
                  <a v-if="safeUrl(item.link)" :href="safeUrl(item.link)!" target="_blank" rel="noopener noreferrer" class="rs-link rs-meta">{{ labels.demoLink }}</a>
                </span>
                <span class="rs-meta whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <div class="rs-body mt-1">{{ item.description }}</div>
            </div>
          </div>
        </section>

        <!-- 专业技能 -->
        <section v-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length" class="rs-section">
          <h2 class="rs-section-title" :class="{ 'rs-section-title--plain': !theme.showBorder }">
            {{ titleOf('skills', modules.skills.title) }}
          </h2>
          <!-- 标签形态：短词堆叠；整句形态：逐行列出 -->
          <div v-if="isTagSkills" class="flex flex-wrap gap-1.5">
            <span v-for="(skill, idx) in modules.skills.items" :key="idx" class="rs-skill-tag">{{ skill }}</span>
          </div>
          <ul v-else class="rs-list list-disc list-inside flex flex-col gap-1">
            <li v-for="(skill, idx) in modules.skills.items" :key="idx" class="rs-item">{{ skill }}</li>
          </ul>
        </section>

        <!-- 教育背景 -->
        <section v-if="modKey === 'education' && modules.education.visible && modules.education.items.length" class="rs-section">
          <h2 class="rs-section-title" :class="{ 'rs-section-title--plain': !theme.showBorder }">
            {{ titleOf('education', modules.education.title) }}
          </h2>
          <div class="flex flex-col gap-2">
            <div v-for="item in modules.education.items" :key="item.id" class="rs-item flex justify-between items-start gap-3">
              <div>
                <span class="rs-item-title">{{ item.school }}</span>
                <span class="rs-meta ml-2">· {{ item.major }}</span>
                <span v-if="item.degree" class="rs-meta ml-2">{{ wrapParen(item.degree, locale) }}</span>
                <p v-if="item.description" class="rs-meta mt-0.5">{{ item.description }}</p>
              </div>
              <span class="rs-meta whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
            </div>
          </div>
        </section>

        <!-- 自定义模块 -->
        <section v-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" class="rs-section">
          <h2 class="rs-section-title" :class="{ 'rs-section-title--plain': !theme.showBorder }">
            {{ titleOf('custom', modules.custom.title) }}
          </h2>
          <ul class="rs-list list-disc list-inside flex flex-col gap-1">
            <li v-for="(item, idx) in modules.custom.items" :key="idx" class="rs-item">{{ item }}</li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
