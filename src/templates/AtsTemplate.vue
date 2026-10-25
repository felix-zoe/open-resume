<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { safeUrl } from '../utils/url';
import { buildDocStyle, showSalaryOf } from './theme';
import { formatDateRange, getLabels, joinList, resolveModuleTitle } from '../i18n/resumeLabels';

/**
 * ATS 单栏模板。
 *
 * 设计约束全部来自「解析器友好」这一条：
 * · 单栏、无侧栏 —— 双栏会被多数解析器按行读取，左右内容混成一句话；
 * · 无图标、无背景色、无头像 —— 图形对解析器是噪音，照片还可能触发歧视审查；
 * · 章节标题用纯文本、标准词（工作经历 / 教育背景 / 专业技能）；
 * · 条目结构固定为「标题行 → 时间行 → 描述」，便于按段落切分。
 *
 * 因此这套模板**不跟随 themeColor 与 showBorder**，只保留字号与间距可调 ——
 * 花哨的强调色在 ATS 里没有任何收益，反而可能被识别为图形元素。
 */
const props = defineProps<{
  content: ResumeContent;
  theme: ThemeConfig;
}>();

const profile = computed(() => props.content.profile);
const modules = computed(() => props.content.modules);
const modulesOrder = computed(
  () => props.content.modulesOrder || ['work', 'projects', 'skills', 'education', 'custom']
);

// 链接仍走 safeUrl：ATS 模板也不该成为 javascript: 的执行入口
const githubUrl = computed(() => safeUrl(profile.value.github));
const websiteUrl = computed(() => safeUrl(profile.value.website));
const showSalary = computed(() => showSalaryOf(props.theme, profile.value));

const docStyle = computed(() => buildDocStyle(props.theme));

// 简历语言只影响文档呈现（标题/日期/分隔符），不碰用户输入的内容
const locale = computed(() => props.content.locale);
const labels = computed(() => getLabels(locale.value));
const titleOf = (key: Parameters<typeof resolveModuleTitle>[0], fallback?: string) =>
  resolveModuleTitle(key, fallback, locale.value);
</script>

<template>
  <div class="ats-template resume-doc w-full bg-white" :style="docStyle">
    <!-- 头部：姓名 → 求职意向 → 联系方式，全部纯文本 -->
    <header class="rs-section">
      <h1 class="rs-name">{{ profile.name || labels.name }}</h1>
      <p v-if="profile.title" class="rs-job-title">{{ profile.title }}</p>

      <p class="rs-contact">
        <template v-if="profile.phone">{{ profile.phone }}</template>
        <template v-if="profile.phone && profile.email"> | </template>
        <template v-if="profile.email">{{ profile.email }}</template>
        <template v-if="profile.location"> | {{ profile.location }}</template>
        <template v-if="profile.workYears"> | {{ profile.workYears }}</template>
        <template v-if="showSalary"> | {{ profile.salaryExpectation }}</template>
        <template v-if="githubUrl"> | {{ profile.github }}</template>
        <template v-if="websiteUrl"> | {{ profile.website }}</template>
      </p>

      <p v-if="profile.summary" class="rs-body mt-2">{{ profile.summary }}</p>
    </header>

    <template v-for="modKey in modulesOrder" :key="modKey">
      <!-- 工作经历 -->
      <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" class="rs-section">
        <h2 class="rs-section-title">{{ titleOf('work', modules.work.title) }}</h2>
        <div v-for="item in modules.work.items" :key="item.id" class="rs-item">
          <p class="rs-item-title">{{ item.company }}<template v-if="item.position"> — {{ item.position }}</template></p>
          <p class="rs-meta">{{ formatDateRange(item.startDate, item.endDate, locale) }}</p>
          <p v-if="item.description" class="rs-body">{{ item.description }}</p>
        </div>
      </section>

      <!-- 项目经历 -->
      <section v-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" class="rs-section">
        <h2 class="rs-section-title">{{ titleOf('projects', modules.projects.title) }}</h2>
        <div v-for="item in modules.projects.items" :key="item.id" class="rs-item">
          <p class="rs-item-title">
            {{ item.name }}<template v-if="item.role"> — {{ item.role }}</template>
          </p>
          <p class="rs-meta">{{ formatDateRange(item.startDate, item.endDate, locale) }}</p>
          <p v-if="item.link" class="rs-meta">{{ item.link }}</p>
          <p v-if="item.description" class="rs-body">{{ item.description }}</p>
        </div>
      </section>

      <!-- 教育背景 -->
      <section v-if="modKey === 'education' && modules.education.visible && modules.education.items.length" class="rs-section">
        <h2 class="rs-section-title">{{ titleOf('education', modules.education.title) }}</h2>
        <div v-for="item in modules.education.items" :key="item.id" class="rs-item">
          <p class="rs-item-title">{{ item.school }}<template v-if="item.degree"> — {{ item.degree }}</template></p>
          <p class="rs-meta">{{ item.major }}<template v-if="item.startDate"> | {{ formatDateRange(item.startDate, item.endDate, locale) }}</template></p>
          <p v-if="item.description" class="rs-body">{{ item.description }}</p>
        </div>
      </section>

      <!-- 专业技能：一行文本，不用标签胶囊 -->
      <section v-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length" class="rs-section">
        <h2 class="rs-section-title">{{ titleOf('skills', modules.skills.title) }}</h2>
        <!-- ATS 模板始终输出一行纯文本：胶囊标签在解析器里会被切成碎片 -->
        <p class="rs-body">{{ joinList(modules.skills.items, locale) }}</p>
      </section>

      <!-- 自定义模块 -->
      <section v-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" class="rs-section">
        <h2 class="rs-section-title">{{ titleOf('custom', modules.custom.title) }}</h2>
        <p v-for="(item, idx) in modules.custom.items" :key="idx" class="rs-body">{{ item }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ATS 模板不做强调色：标题用黑色粗体 + 下划线，是解析器最容易识别的形式 */
.ats-template .rs-name {
  color: #111827;
}

.ats-template .rs-section-title {
  color: #111827;
  border-bottom-color: #9ca3af;
  text-transform: none;
}
</style>
