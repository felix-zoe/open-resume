<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { safeUrl } from '../utils/url';
import { Mail, Phone, MapPin, Globe, Github, Briefcase, Wallet } from 'lucide-vue-next';
import { buildDocStyle, showSalaryOf } from './theme';
import { formatDateRange, getLabels, resolveModuleTitle, wrapParen } from '../i18n/resumeLabels';

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

// 注意：模板根节点不能再设置 min-height，否则内容高度测量会恒等于一页。
// 纸张的 297mm 由外层 .a4-print-target 提供。
// 页边距由两栏各自承担（而非纸张）：侧栏底色要铺满纸张左右边缘，
// 若纸张再加 padding，侧栏就会被推离边缘、露出白边。
const docStyle = computed(() => buildDocStyle(props.theme));

// 简历语言只影响文档呈现（标题/日期/分隔符），不碰用户输入的内容
const locale = computed(() => props.content.locale);
const labels = computed(() => getLabels(locale.value));
const titleOf = (key: Parameters<typeof resolveModuleTitle>[0], fallback?: string) =>
  resolveModuleTitle(key, fallback, locale.value);

/** 技能形态（TPL-04）：侧栏窄，默认标签，显式选「整句」时才逐行 */
const isSentenceSkills = computed(() => modules.value.skills.type === 'sentence');

/** 两栏各自的页边距；高度方向的留白在侧栏/主栏内部用 padding 表达 */
const columnStyle = computed(() => {
  const mm = Number(props.theme.pagePadding);
  const safe = Number.isFinite(mm) && mm >= 0 ? mm : 0;
  return {
    paddingTop: `${safe}mm`,
    paddingBottom: `${safe}mm`,
  };
});

/** 侧栏只贴左边，主栏只贴右边，中间由栏间距负责 */
const sidebarStyle = computed(() => ({
  ...columnStyle.value,
  paddingLeft: `${Number(props.theme.pagePadding) || 0}mm`,
  paddingRight: '0.8em',
}));

const mainStyle = computed(() => ({
  ...columnStyle.value,
  paddingLeft: '0.8em',
  paddingRight: `${Number(props.theme.pagePadding) || 0}mm`,
}));

/**
 * 双栏分工：教育/技能属于侧栏，工作/项目/自定义属于主栏。
 *
 * 栏位归属是模板的布局差异，但**栏内顺序必须跟随 modulesOrder**（TPL-03）：
 * 用户在排序抽屉里把“技能”拖到“教育”前面，侧栏就应先出现技能。
 * 旧实现把两个模块的顺序写死在模板里，排序对它们完全无效。
 */
const sidebarModuleKeys = ['education', 'skills'] as const;

/** 只保留侧栏模块，且保持 modulesOrder 里的相对顺序 */
const orderedSidebarKeys = computed(() =>
  modulesOrder.value.filter((key): key is (typeof sidebarModuleKeys)[number] =>
    (sidebarModuleKeys as readonly string[]).includes(key)
  )
);

const hasVisibleSidebarModule = computed(() =>
  orderedSidebarKeys.value.some((key) => modules.value[key].visible && modules.value[key].items.length > 0)
);
</script>

<template>
  <div class="modern-template resume-doc w-full bg-white flex" :class="theme.fontFamily" :style="docStyle">
    <!-- 左侧侧边栏 -->
    <div
      class="resume-sidebar w-[32%] bg-slate-50 border-r border-slate-200 flex flex-col gap-5 flex-shrink-0"
      :style="sidebarStyle"
    >
      <!-- 头像 -->
      <div v-if="profile.showAvatar && profile.avatar" class="flex justify-center">
        <img
          :src="profile.avatar"
          alt=""
          loading="lazy"
          width="100"
          height="100"
          class="rounded-full object-cover border-2 border-white"
          style="width: 5.4em; height: 5.4em"
        />
      </div>

      <!-- 姓名与意向 -->
      <div class="text-center">
        <h1 class="rs-name" style="font-size: 1.4em">{{ profile.name || labels.name }}</h1>
        <p class="rs-meta mt-1">{{ profile.title || labels.jobTitle }}</p>
      </div>

      <!-- 联系方式 -->
      <div class="rs-contact flex flex-col gap-2 pt-4 border-t border-slate-200">
        <div v-if="profile.phone" class="flex items-center gap-2">
          <Phone class="rs-icon" />
          <span>{{ profile.phone }}</span>
        </div>
        <div v-if="profile.email" class="flex items-center gap-2">
          <Mail class="rs-icon" />
          <span class="break-all">{{ profile.email }}</span>
        </div>
        <div v-if="profile.location" class="flex items-center gap-2">
          <MapPin class="rs-icon" />
          <span>{{ profile.location }}</span>
        </div>
        <div v-if="profile.workYears" class="flex items-center gap-2">
          <Briefcase class="rs-icon" />
          <span>{{ profile.workYears }}</span>
        </div>
        <div v-if="showSalary" class="flex items-center gap-2">
          <Wallet class="rs-icon" />
          <span>{{ profile.salaryExpectation }}</span>
        </div>
        <div v-if="githubUrl" class="flex items-center gap-2">
          <Github class="rs-icon" />
          <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="rs-link truncate">GitHub</a>
        </div>
        <div v-if="websiteUrl" class="flex items-center gap-2">
          <Globe class="rs-icon" />
          <a :href="websiteUrl" target="_blank" rel="noopener noreferrer" class="rs-link truncate">{{ labels.portfolio }}</a>
        </div>
      </div>

      <!-- 侧栏模块：按 modulesOrder 中的相对顺序渲染 -->
      <template v-for="modKey in orderedSidebarKeys" :key="`side-${modKey}`">
        <div
          v-if="modKey === 'education' && modules.education.visible && modules.education.items.length"
          class="pt-4 border-t border-slate-200"
        >
          <h3 class="rs-section-title rs-section-title--plain border-b-0 pb-0 mb-2">{{ titleOf('education', modules.education.title) }}</h3>
          <div class="flex flex-col gap-2">
            <div v-for="item in modules.education.items" :key="item.id" class="rs-item">
              <div class="rs-item-title" style="font-size: 0.95em">{{ item.school }}</div>
              <div class="rs-meta"><template v-if="item.major">{{ item.major }}</template><template v-if="item.major && item.degree"> · </template><template v-if="item.degree">{{ item.degree }}</template></div>
              <div class="rs-meta">{{ formatDateRange(item.startDate, item.endDate, locale) }}</div>
            </div>
          </div>
        </div>

        <div
          v-else-if="modKey === 'skills' && modules.skills.visible && modules.skills.items.length"
          class="pt-4 border-t border-slate-200"
        >
          <h3 class="rs-section-title rs-section-title--plain border-b-0 pb-0 mb-2">{{ titleOf('skills', modules.skills.title) }}</h3>
          <!-- 侧栏窄，默认标签；用户切成整句时逐行列出 -->
          <div v-if="!isSentenceSkills" class="flex flex-wrap gap-1">
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
        </div>
      </template>

      <!-- 侧栏没有任何模块时保留一个占位，避免底色断层 -->
      <div v-if="!hasVisibleSidebarModule" class="flex-1" aria-hidden="true"></div>
    </div>

    <!-- 右侧主体内容 -->
    <div class="resume-main w-[68%] flex-1" :style="mainStyle">
      <!-- 个人总结 -->
      <section v-if="profile.summary" class="mb-5 bg-slate-50/70 p-3 rounded border border-slate-100">
        <p class="rs-summary">{{ profile.summary }}</p>
      </section>

      <!-- 主栏模块：按 modulesOrder 渲染 -->
      <template v-for="modKey in modulesOrder" :key="`main-${modKey}`">
        <section v-if="modKey === 'work' && modules.work.visible && modules.work.items.length" class="rs-section">
          <h2
            class="rs-section-title flex items-center gap-2"
            :class="{ 'rs-section-title--plain': !theme.showBorder }"
            :style="{ borderBottomWidth: theme.showBorder ? '2px' : '0' }"
          >
            <span :style="{ color: theme.themeColor }">▍</span>
            {{ titleOf('work', modules.work.title) }}
          </h2>
          <div class="flex flex-col gap-4">
            <div v-for="item in modules.work.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title">
                  {{ item.company }}
                  <span class="font-normal rs-meta">· {{ item.position }}</span>
                </span>
                <span class="rs-meta whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <p class="rs-body mt-1">{{ item.description }}</p>
            </div>
          </div>
        </section>

        <section v-else-if="modKey === 'projects' && modules.projects.visible && modules.projects.items.length" class="rs-section">
          <h2
            class="rs-section-title flex items-center gap-2"
            :class="{ 'rs-section-title--plain': !theme.showBorder }"
            :style="{ borderBottomWidth: theme.showBorder ? '2px' : '0' }"
          >
            <span :style="{ color: theme.themeColor }">▍</span>
            {{ titleOf('projects', modules.projects.title) }}
          </h2>
          <div class="flex flex-col gap-4">
            <div v-for="item in modules.projects.items" :key="item.id" class="rs-item">
              <div class="flex justify-between items-baseline gap-3">
                <span class="rs-item-title">
                  {{ item.name }}
                  <span v-if="item.role" class="font-normal rs-meta">{{ wrapParen(item.role, locale) }}</span>
                </span>
                <span class="rs-meta whitespace-nowrap">{{ formatDateRange(item.startDate, item.endDate, locale) }}</span>
              </div>
              <p class="rs-body mt-1">{{ item.description }}</p>
            </div>
          </div>
        </section>

        <section v-else-if="modKey === 'custom' && modules.custom.visible && modules.custom.items.length" class="rs-section">
          <h2
            class="rs-section-title flex items-center gap-2"
            :class="{ 'rs-section-title--plain': !theme.showBorder }"
            :style="{ borderBottomWidth: theme.showBorder ? '2px' : '0' }"
          >
            <span :style="{ color: theme.themeColor }">▍</span>
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
