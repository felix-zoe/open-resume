<script setup lang="ts">
import { computed } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { Mail, Phone, MapPin, Globe, Github, Briefcase } from 'lucide-vue-next';

const props = defineProps<{
  content: ResumeContent;
  theme: ThemeConfig;
}>();

const { profile, modules } = props.content;

const containerStyle = computed(() => ({
  fontSize: `${props.theme.fontSize}px`,
  lineHeight: props.theme.lineHeight,
  minHeight: '297mm'
}));

const sectionMarginStyle = computed(() => ({
  marginBottom: `${props.theme.sectionSpacing}px`
}));
</script>

<template>
  <div class="modern-template w-full bg-white flex min-h-[297mm] text-gray-800" :class="theme.fontFamily" :style="containerStyle">
    <!-- 左侧侧边栏 (32% 宽度，浅色底色或主题色轻浅过渡) -->
    <aside class="w-[32%] bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-5 flex-shrink-0">
      <!-- 头像 -->
      <div v-if="profile.showAvatar && profile.avatar" class="flex justify-center">
        <img :src="profile.avatar" alt="Avatar" class="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-white" />
      </div>

      <!-- 姓名与意向 -->
      <div class="text-center">
        <h1 class="text-xl font-bold text-slate-900" :style="{ color: theme.themeColor }">
          {{ profile.name || '姓名' }}
        </h1>
        <p class="text-xs font-medium text-slate-500 mt-1">
          {{ profile.title || '求职意向' }}
        </p>
      </div>

      <!-- 联系方式 -->
      <div class="space-y-2 text-xs text-slate-600 border-t border-slate-200 pt-4">
        <div v-if="profile.phone" class="flex items-center gap-2">
          <Phone class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ profile.phone }}</span>
        </div>
        <div v-if="profile.email" class="flex items-center gap-2">
          <Mail class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ profile.email }}</span>
        </div>
        <div v-if="profile.location" class="flex items-center gap-2">
          <MapPin class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ profile.location }}</span>
        </div>
        <div v-if="profile.workYears" class="flex items-center gap-2">
          <Briefcase class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ profile.workYears }}</span>
        </div>
        <div v-if="profile.salaryExpectation" class="flex items-center gap-2 text-emerald-600 font-medium">
          <span>💰</span>
          <span>{{ profile.salaryExpectation }}</span>
        </div>
        <div v-if="profile.github" class="flex items-center gap-2">
          <Github class="w-3.5 h-3.5 text-slate-400" />
          <a :href="profile.github" target="_blank" class="hover:underline truncate text-blue-600">GitHub</a>
        </div>
        <div v-if="profile.website" class="flex items-center gap-2">
          <Globe class="w-3.5 h-3.5 text-slate-400" />
          <a :href="profile.website" target="_blank" class="hover:underline truncate text-blue-600">作品集</a>
        </div>
      </div>

      <!-- 教育背景放侧边栏（如果启用） -->
      <div v-if="modules.education.visible && modules.education.items.length" class="border-t border-slate-200 pt-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          {{ modules.education.title }}
        </h3>
        <div class="space-y-2 text-xs">
          <div v-for="item in modules.education.items" :key="item.id" class="resume-section-item">
            <div class="font-semibold text-slate-800">{{ item.school }}</div>
            <div class="text-slate-500">{{ item.major }} · {{ item.degree }}</div>
            <div class="text-slate-400 text-[10px]">{{ item.startDate }} - {{ item.endDate }}</div>
          </div>
        </div>
      </div>

      <!-- 专业技能标签 -->
      <div v-if="modules.skills.visible && modules.skills.items.length" class="border-t border-slate-200 pt-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
          {{ modules.skills.title }}
        </h3>
        <div class="flex flex-wrap gap-1 text-[11px]">
          <span v-for="(skill, idx) in modules.skills.items" :key="idx"
                class="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded shadow-2xs">
            {{ skill }}
          </span>
        </div>
      </div>
    </aside>

    <!-- 右侧主体内容 (68% 宽度) -->
    <main class="w-[68%] p-8 flex-1">
      <!-- 个人评价/总结 -->
      <section v-if="profile.summary" class="mb-5 bg-slate-50/70 p-3 rounded border border-slate-100">
        <p class="text-xs text-slate-600 leading-relaxed">
          {{ profile.summary }}
        </p>
      </section>

      <!-- 工作经历 -->
      <section v-if="modules.work.visible && modules.work.items.length" :style="sectionMarginStyle">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 pb-1 mb-3 border-b-2 flex items-center gap-2"
            :style="{ borderColor: theme.themeColor }">
          <span :style="{ color: theme.themeColor }">▍</span>
          <span>{{ modules.work.title }}</span>
        </h2>
        <div class="space-y-4">
          <div v-for="item in modules.work.items" :key="item.id" class="resume-section-item">
            <div class="flex justify-between items-baseline font-semibold text-slate-900 text-xs">
              <span>{{ item.company }} <span class="font-normal text-slate-500">· {{ item.position }}</span></span>
              <span class="text-slate-400 text-[11px]">{{ item.startDate }} - {{ item.endDate }}</span>
            </div>
            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed mt-1">
              {{ item.description }}
            </p>
          </div>
        </div>
      </section>

      <!-- 项目经历 -->
      <section v-if="modules.projects.visible && modules.projects.items.length" :style="sectionMarginStyle">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 pb-1 mb-3 border-b-2 flex items-center gap-2"
            :style="{ borderColor: theme.themeColor }">
          <span :style="{ color: theme.themeColor }">▍</span>
          <span>{{ modules.projects.title }}</span>
        </h2>
        <div class="space-y-4">
          <div v-for="item in modules.projects.items" :key="item.id" class="resume-section-item">
            <div class="flex justify-between items-baseline font-semibold text-slate-900 text-xs">
              <span>{{ item.name }} <span v-if="item.role" class="font-normal text-slate-500">({{ item.role }})</span></span>
              <span class="text-slate-400 text-[11px]">{{ item.startDate }} - {{ item.endDate }}</span>
            </div>
            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed mt-1">
              {{ item.description }}
            </p>
          </div>
        </div>
      </section>

      <!-- 自定义模块 -->
      <section v-if="modules.custom.visible && modules.custom.items.length" :style="sectionMarginStyle">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900 pb-1 mb-3 border-b-2 flex items-center gap-2"
            :style="{ borderColor: theme.themeColor }">
          <span :style="{ color: theme.themeColor }">▍</span>
          <span>{{ modules.custom.title }}</span>
        </h2>
        <ul class="list-disc list-inside text-xs text-slate-600 space-y-1">
          <li v-for="(item, idx) in modules.custom.items" :key="idx" class="resume-section-item">
            {{ item }}
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
