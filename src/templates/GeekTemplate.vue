<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { safeUrl } from '../utils/url';
import { Terminal, ExternalLink, Mail, Phone, MapPin, Briefcase, Wallet, Github, Globe } from 'lucide-vue-next';
import { buildDocStyle, showSalaryOf } from './theme';
import {
  MODULE_CODE_LABELS,
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
const modulesOrder = computed(() => props.content.modulesOrder || ['skills', 'work', 'projects', 'education', 'custom']);

// 用户输入的外链必须先校验协议，避免 javascript: 在公开分享页执行
const githubUrl = computed(() => safeUrl(profile.value.github));
const websiteUrl = computed(() => safeUrl(profile.value.website));
const showSalary = computed(() => showSalaryOf(props.theme, profile.value));

const docStyle = computed(() => buildDocStyle(props.theme));

/**
 * 极客模板的模块标题：主标题跟随简历语言，英文副标签始终保留。
 *
 * 副标签是版式的一部分（`#SKILLS` 这种代码风），不是语言——中文简历里
 * 也照样显示，所以不随 locale 变化。
 */
const sectionLabels = MODULE_CODE_LABELS;

const locale = computed(() => props.content.locale);
const labels = computed(() => getLabels(locale.value));
const titleOf = (key: keyof typeof sectionLabels, fallback?: string) =>
  resolveModuleTitle(key, fallback, locale.value);

/** 技能形态（TPL-04）：极客模板默认标签，显式选「整句」时才逐行 */
const isSentenceSkills = computed(() => modules.value.skills.type === 'sentence');
</script>

<template>
  <div class="geek-template resume-doc w-full bg-white" :class="theme.fontFamily || 'font-mono'" :style="docStyle">
    <!-- 极客风头部 -->
    <div class="resume-header pl-4 py-1 mb-5" :style="{ borderLeft: `4px solid ${theme.themeColor}` }">
      <div class="flex items-center justify-between">
        <div class="min-w-0">
          <h1 class="rs-name flex items-center gap-2">
            <Terminal class="rs-icon" :style="{ color: theme.themeColor }" />
            {{ profile.name || labels.name }}
          </h1>
          <p class="rs-job-title mt-0.5">{{ profile.title || labels.jobTitle }}</p>
        </div>
        <div v-if="profile.showAvatar && profile.avatar" class="ml-4 flex-shrink-0">
          <img
            :src="profile.avatar"
            alt=""
            loading="lazy"
            width="100"
            height="100"
            class="rounded-full object-cover"
            :style="{ width: '4.2em', height: '4.2em', border: `2px solid ${theme.themeColor}` }"
          />
        </div>
      </div>

      <div class="rs-contact font-sans flex flex-wrap gap-x-4 gap-y-1 mt-2">
        <span v-if="profile.phone" class="inline-flex items-center gap-1"><Phone class="rs-icon" /> {{ profile.phone }}</span>
        <span v-if="profile.email" class="inline-flex items-center gap-1"><Mail class="rs-icon" /> {{ profile.email }}</span>
        <span v-if="profile.location" class="inline-flex items-center gap-1"><MapPin class="rs-icon" /> {{ profile.location }}</span>
        <span v-if="profile.workYears" class="inline-flex items-center gap-1"><Briefcase class="rs-icon" /> {{ profile.workYears }}</span>
        <span v-if="showSalary" class="inline-flex items-center gap-1"><Wallet class="rs-icon" /> {{ profile.salaryExpectation }}</span>
        <a v-if="githubUrl" :href="githubUrl" target="_blank" rel="noopener noreferrer" class="rs-link inline-flex items-center gap-1">
          <Github class="rs-icon" /> GitHub
        </a>
        <a v-if="websiteUrl" :href="websiteUrl" target="_blank" rel="noopener noreferrer" class="rs-link inline-flex items-center gap-1">
          <Globe class="rs-icon" /> {{ labels.portfolio }} <ExternalLink class="rs-icon" />
        </a>
      </div>

      <p v-if="profile.summary" class="rs-summary font-sans mt-2">// {{ profile.summary }}</p>
    </div>

    <!-- 动态模块 -->
    <div class="geek-body font-sans">
      <template v-for="modKey in modulesOrder" :key="modKey">
        <!-- 技能 -->
        <section v-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length" class="rs-section">
          <h2 class="rs-section-title rs-section-title--plain flex items-center gap-1.5 font-mono border-b-0 pb-0">
            <span class="inline-block rounded-full" :style="{ width: '0.5em', height: '0.5em', background: theme.themeColor }"></span>
            {{ titleOf('skills', modules.skills.title) }}
            <span class="rs-meta font-normal">#{{ sectionLabels.skills }}</span>
          </h2>
          <!-- 极客模板默认标签；用户切成整句时改为逐行，避免长句挤在胶囊里 -->
          <div v-if="!isSentenceSkills" class="flex flex-wrap gap-1.5">
            <span
              v-for="(skill, idx) in modules.skills.items"
              :key="idx"
              class="rs-skill-tag"
              :class="{ 'rs-skill-tag--accent': theme.showBorder }"
            >
              {{ skill }}
            </span>
          </div>
          <ul v-else class="rs-list list-disc list-inside flex flex-col gap-1">
            <li v-for="(skill, idx) in modules.skills.items" :key="idx" class="rs-item">{{ skill }}</li>
          </ul>
        </section>

        <!-- 工作经历 -->
        <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" class="rs-section">
          <h2 class="rs-section-title rs-section-title--plain flex items-center gap-1.5 font-mono border-b-0 pb-0">
            <span class="inline-block rounded-full" :style="{ width: '0.5em', height: '0.5em', background: theme.themeColor }"></span>
            {{ titleOf('work', modules.work.title) }}
            <span class="rs-meta font-normal">#{{ sectionLabels.work }}</span>
          </h2>
          <div class="flex flex-col gap-3">
            <div v-for="item in modules.work.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title">
                  {{ item.company }}
                  <span class="font-normal rs-meta">/ {{ item.position }}</span>
                </span>
                <span class="rs-meta font-mono whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <p class="rs-body mt-1">{{ item.description }}</p>
            </div>
          </div>
        </section>

        <!-- 项目经历 -->
        <section v-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" class="rs-section">
          <h2 class="rs-section-title rs-section-title--plain flex items-center gap-1.5 font-mono border-b-0 pb-0">
            <span class="inline-block rounded-full" :style="{ width: '0.5em', height: '0.5em', background: theme.themeColor }"></span>
            {{ titleOf('projects', modules.projects.title) }}
            <span class="rs-meta font-normal">#{{ sectionLabels.projects }}</span>
          </h2>
          <div class="flex flex-col gap-3">
            <div v-for="item in modules.projects.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title">
                  {{ item.name }}
                  <span v-if="item.role" class="font-normal rs-meta">{{ wrapParen(item.role, locale) }}</span>
                </span>
                <span class="rs-meta font-mono whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <p class="rs-body mt-1">{{ item.description }}</p>
            </div>
          </div>
        </section>

        <!-- 教育背景 -->
        <section v-if="modKey === 'education' && modules.education.visible && modules.education.items.length" class="rs-section">
          <h2 class="rs-section-title rs-section-title--plain flex items-center gap-1.5 font-mono border-b-0 pb-0">
            <span class="inline-block rounded-full" :style="{ width: '0.5em', height: '0.5em', background: theme.themeColor }"></span>
            {{ titleOf('education', modules.education.title) }}
            <span class="rs-meta font-normal">#{{ sectionLabels.education }}</span>
          </h2>
          <div class="flex flex-col gap-1.5">
            <div v-for="item in modules.education.items" :key="item.id" class="rs-item flex justify-between gap-3">
              <span class="rs-body"><strong>{{ item.school }}</strong><template v-if="item.major"> · {{ item.major }}</template><template v-if="item.degree">{{ wrapParen(item.degree, locale) }}</template></span>
              <span class="rs-meta font-mono whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
            </div>
          </div>
        </section>

        <!-- 自定义模块 -->
        <section v-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" class="rs-section">
          <h2 class="rs-section-title rs-section-title--plain flex items-center gap-1.5 font-mono border-b-0 pb-0">
            <span class="inline-block rounded-full" :style="{ width: '0.5em', height: '0.5em', background: theme.themeColor }"></span>
            {{ titleOf('custom', modules.custom.title) }}
            <span class="rs-meta font-normal">#{{ sectionLabels.custom }}</span>
          </h2>
          <ul class="rs-list list-disc list-inside flex flex-col gap-1">
            <li v-for="(item, idx) in modules.custom.items" :key="idx" class="rs-item">{{ item }}</li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
