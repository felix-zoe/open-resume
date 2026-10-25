<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AppFooter from '../components/AppFooter.vue';
import AuthModal from '../components/AuthModal.vue';
import CreateResumeDialog, { type ResumeStart } from '../components/dashboard/CreateResumeDialog.vue';
import ResumeCard from '../components/dashboard/ResumeCard.vue';
import ShareDialog from '../components/share/ShareDialog.vue';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmpty,
  AppInput,
  AppModal,
  AppSelect,
  AppSkeleton,
  FormField
} from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useResumes, type ResumeSummary } from '../composables/useResumes';
import { apiFetch } from '../utils/http';
import {
  DEFAULT_EN_RESUME_CONTENT,
  DEFAULT_RESUME_CONTENT,
  DEFAULT_THEME_CONFIG,
  buildEmptyContent
} from '../utils/presets';
import type { ResumeContent, ThemeConfig } from '../types/resume';
import type { ResumeLocale } from '../../shared/types';
import { useToast } from '../composables/useToast';
import { Activity, Briefcase, Download, FileText, LayoutGrid, List, Plus, Search } from 'lucide-vue-next';
import { trackEvent } from '../utils/telemetry';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const {
  resumes,
  loading,
  errorMsg,
  isEmpty,
  busyId,
  totals,
  load,
  rename,
  toggleShare,
  duplicate,
  remove
} = useResumes();

// ---------------- 新建 ----------------
const isCreateOpen = ref(false);
const creating = ref(false);

/** 起点为「复制已有」时，源简历的内容需要单独取一次（列表里只有摘要） */
async function loadCopySource(id: string) {
  const result = await apiFetch<{ content: ResumeContent; themeConfig: ThemeConfig }>(
    `/api/resumes/${id}`
  );
  return result.ok && result.data ? result.data : null;
}

async function handleCreate(payload: {
  templateId: string;
  title: string;
  start: ResumeStart;
  copyFromId?: string;
  locale?: ResumeLocale;
}) {
  creating.value = true;
  try {
    const locale = payload.locale ?? 'zh-CN';
    // 空白起点：按语言给出对应的空骨架（英文简历的模块标题就是 Work Experience）
    // 示例起点：中文给完整范文，英文给英文范文
    let content =
      payload.start === 'sample'
        ? locale === 'en'
          ? DEFAULT_EN_RESUME_CONTENT
          : DEFAULT_RESUME_CONTENT
        : buildEmptyContent(locale);
    let themeConfig = DEFAULT_THEME_CONFIG;

    if (payload.start === 'copy' && payload.copyFromId) {
      const source = await loadCopySource(payload.copyFromId);
      if (!source) {
        toast.error('读取源简历失败，请稍后重试');
        return;
      }
      // 深拷贝：直接引用会让新简历与源简历共享同一份对象，改一边动两边
      content = JSON.parse(JSON.stringify(source.content)) as ResumeContent;
      themeConfig = JSON.parse(JSON.stringify(source.themeConfig)) as ThemeConfig;
    }

    const result = await apiFetch<{ id: string }>('/api/resumes', {
      method: 'POST',
      body: {
        title: payload.title,
        templateId: payload.templateId,
        content,
        themeConfig
      }
    });
    if (!result.ok || !result.data?.id) {
      toast.error(result.message || '新建简历失败');
      return;
    }
    // 只记起点类型（空白/示例/复制），不记模板与简历 id
    trackEvent(`resume.create.${payload.start}`);
    isCreateOpen.value = false;
    router.push(`/editor/${result.data.id}`);
  } finally {
    creating.value = false;
  }
}

function handleGuestNext(payload: { templateId: string; locale?: ResumeLocale }) {
  isCreateOpen.value = false;
  const query: Record<string, string> = { template: payload.templateId };
  if (payload.locale && payload.locale !== 'zh-CN') query.locale = payload.locale;
  router.push({ path: '/editor/new', query });
}

// ---------------- 搜索 / 排序 ----------------
const keyword = ref('');
const debouncedKeyword = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(keyword, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedKeyword.value = value.trim().toLowerCase();
  }, 200);
});

type SortKey = 'updated' | 'title' | 'views';
const sortKey = ref<SortKey>('updated');
const sortOptions = [
  { value: 'updated', label: '按更新时间' },
  { value: 'title', label: '按名称' },
  { value: 'views', label: '按浏览量' }
];

const visibleResumes = computed(() => {
  const term = debouncedKeyword.value;
  const filtered = term
    ? resumes.value.filter((item) => item.title.toLowerCase().includes(term))
    : [...resumes.value];

  return filtered.sort((a, b) => {
    if (sortKey.value === 'title') return a.title.localeCompare(b.title, 'zh-Hans-CN');
    if (sortKey.value === 'views') return b.stats.totalViews - a.stats.totalViews;
    return Number(b.updatedAt) - Number(a.updatedAt);
  });
});

// ---------------- 视图密度 ----------------
type ViewMode = 'grid' | 'list';
const VIEW_STORAGE_KEY = 'open_resume_dashboard_view';
const viewMode = ref<ViewMode>('grid');

const viewOptions = [
  { value: 'grid' as const, label: '网格视图', icon: LayoutGrid },
  { value: 'list' as const, label: '列表视图', icon: List }
];

onMounted(() => {
  const saved = localStorage.getItem(VIEW_STORAGE_KEY);
  if (saved === 'grid' || saved === 'list') viewMode.value = saved;
});

watch(viewMode, (value) => {
  // 偏好写本地即可，没必要为展示密度打一次接口
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, value);
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
});

// ---------------- 单卡片操作 ----------------
const openMenuId = ref<string | null>(null);

function formatTime(time: string | number) {
  const seconds = typeof time === 'number' ? time : Number(time);
  if (!Number.isFinite(seconds)) return String(time);
  const date = new Date(seconds * 1000);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/** 分享设置弹窗（token 化链接、有效期、密码、二维码），与编辑器共用同一组件 */
const shareTarget = ref<ResumeSummary | null>(null);
const shareDialogOpen = computed({
  get: () => shareTarget.value !== null,
  set: (value: boolean) => {
    if (!value) shareTarget.value = null;
  }
});

function openShareDialog(item: ResumeSummary) {
  openMenuId.value = null;
  shareTarget.value = item;
}

function onSharePublicChange(value: number) {
  if (shareTarget.value) shareTarget.value.isPublic = value;
}

async function handleDuplicate(item: ResumeSummary) {
  openMenuId.value = null;
  await duplicate(item);
}

async function handleDelete(item: ResumeSummary) {
  openMenuId.value = null;
  await remove(item);
}

// ---------------- 重命名 ----------------
const renameTarget = ref<ResumeSummary | null>(null);
const renameValue = ref('');
const renameError = ref('');
const renaming = ref(false);

function openRename(item: ResumeSummary) {
  openMenuId.value = null;
  renameTarget.value = item;
  renameValue.value = item.title;
  renameError.value = '';
}

const renameOpen = computed({
  get: () => renameTarget.value !== null,
  set: (value: boolean) => {
    if (!value) renameTarget.value = null;
  }
});

async function submitRename() {
  if (!renameTarget.value) return;
  const value = renameValue.value.trim();
  if (!value) {
    renameError.value = '名称不能为空';
    return;
  }
  if (value.length > 100) {
    renameError.value = '名称不能超过 100 个字符';
    return;
  }
  renaming.value = true;
  try {
    const ok = await rename(renameTarget.value, value);
    if (ok) renameTarget.value = null;
  } finally {
    renaming.value = false;
  }
}

// ---------------- 在线访问统计 ----------------
const isAnalyticsOpen = ref(false);
const analyticsTarget = ref<ResumeSummary | null>(null);
const analyticsData = ref<any>(null);
const loadingAnalytics = ref(false);

async function openAnalytics(item: ResumeSummary) {
  analyticsTarget.value = item;
  analyticsData.value = null;
  isAnalyticsOpen.value = true;
  loadingAnalytics.value = true;
  try {
    const result = await apiFetch<any>(`/api/resumes/${item.id}/analytics`);
    if (result.ok && result.data) analyticsData.value = result.data;
  } finally {
    loadingAnalytics.value = false;
  }
}

const analyticsOpen = computed({
  get: () => isAnalyticsOpen.value,
  set: (value: boolean) => {
    isAnalyticsOpen.value = value;
  }
});

// ---------------- 登录弹窗 ----------------
const isAuthModalOpen = ref(false);

onMounted(() => {
  if (authStore.isLoggedIn) load();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <Navbar />

    <main id="main-content" tabindex="-1" class="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
      <!-- 顶部标题 + 汇总 -->
      <header class="mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900">我的简历</h1>
            <p class="text-xs text-slate-500 mt-1">
              针对不同岗位维护多份简历，导出 PDF 或生成在线只读链接
            </p>
          </div>
          <div class="flex items-center gap-2">
            <AppButton variant="secondary" @click="router.push('/jobs')">
              <template #icon>
                <Briefcase class="w-4 h-4" aria-hidden="true" />
              </template>
              <span>投递管理</span>
            </AppButton>
            <AppButton @click="isCreateOpen = true">
              <template #icon>
                <Plus class="w-4 h-4" aria-hidden="true" />
              </template>
              <span>新建简历</span>
            </AppButton>
          </div>
        </div>

        <!-- 汇总指标 -->
        <dl class="grid grid-cols-3 gap-3 mt-5 max-w-xl">
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">简历数量</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ resumes.length }}</dd>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">累计浏览</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ totals.views }}</dd>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">导出次数</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ totals.downloads }}</dd>
          </div>
        </dl>
      </header>

      <!-- 搜索 / 排序 -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
        <div class="relative flex-1 sm:max-w-xs">
          <Search
            class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <AppInput
            v-model="keyword"
            has-leading
            placeholder="搜索简历名称"
            aria-label="搜索简历名称"
          />
        </div>
        <div class="w-full sm:w-36">
          <AppSelect
            :model-value="sortKey"
            :options="sortOptions"
            aria-label="排序方式"
            @update:model-value="sortKey = $event as SortKey"
          />
        </div>

        <!-- 视图密度：简历多了以后，列表一屏能扫十几份 -->
        <div
          class="hidden sm:inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0"
          role="group"
          aria-label="切换视图"
        >
          <button
            v-for="option in viewOptions"
            :key="option.value"
            type="button"
            class="p-1.5 rounded-md transition"
            :class="
              viewMode === option.value
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            "
            :aria-label="option.label"
            :aria-pressed="viewMode === option.value"
            :title="option.label"
            @click="viewMode = option.value"
          >
            <component :is="option.icon" class="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- 加载骨架 -->
      <div
        v-if="loading && !resumes.length"
        class="grid gap-4"
        :class="viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'"
      >
        <AppCard v-for="i in 3" :key="i">
          <AppSkeleton height-class="h-3" class="w-1/3" />
          <AppSkeleton height-class="h-4" class="mt-3 w-3/4" />
          <AppSkeleton height-class="h-9" class="mt-4" />
          <AppSkeleton height-class="h-8" class="mt-3" />
        </AppCard>
      </div>

      <!-- 错误 -->
      <AppCard v-else-if="errorMsg" class="text-center py-10">
        <p class="text-sm font-semibold text-slate-800">加载失败</p>
        <p class="text-xs text-slate-500 mt-1">{{ errorMsg }}</p>
        <AppButton variant="secondary" class="mt-4" @click="load">重试</AppButton>
      </AppCard>

      <!-- 空态 -->
      <AppEmpty
        v-else-if="isEmpty"
        title="还没有简历"
        description="新建一份简历只需四步：选模板、选起点、命名、开始编辑。内容会自动保存。"
      >
        <template #action>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <AppButton @click="isCreateOpen = true">
              <template #icon>
                <Plus class="w-4 h-4" aria-hidden="true" />
              </template>
              <span>新建第一份简历</span>
            </AppButton>
            <!-- 第二条路径：不知道怎么写的人先看示例，比对着空白表单发呆有用 -->
            <AppButton variant="secondary" @click="router.push('/editor/demo')">
              <template #icon>
                <FileText class="w-4 h-4" aria-hidden="true" />
              </template>
              <span>先看示例简历</span>
            </AppButton>
          </div>
        </template>
      </AppEmpty>

      <!-- 搜索无结果 -->
      <AppEmpty
        v-else-if="!visibleResumes.length"
        title="没有匹配的简历"
        :description="`没有名称包含「${debouncedKeyword}」的简历，换个关键词试试。`"
      >
        <template #action>
          <AppButton variant="secondary" @click="keyword = ''">清除搜索</AppButton>
        </template>
      </AppEmpty>

      <!-- 简历列表 -->
      <div
        v-else
        class="grid gap-4"
        :class="viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'"
      >
        <ResumeCard
          v-for="item in visibleResumes"
          :key="item.id"
          :item="item"
          :mode="viewMode"
          :busy="busyId === item.id"
          :menu-open="openMenuId === item.id"
          @update:menu-open="openMenuId = $event ? item.id : null"
          @rename="openRename(item)"
          @duplicate="handleDuplicate(item)"
          @delete="handleDelete(item)"
          @toggle-share="toggleShare(item)"
          @share-settings="openShareDialog(item)"
          @analytics="openAnalytics(item)"
        />

        <!-- 新建卡片：列表模式下收成一条横条，避免在密集视图里显得突兀 -->
        <button
          v-if="viewMode === 'grid'"
          type="button"
          class="border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50/30 rounded-xl p-5 min-h-[210px] flex flex-col items-center justify-center text-center transition group"
          @click="isCreateOpen = true"
        >
          <span class="w-11 h-11 rounded-full bg-slate-100 group-hover:bg-primary-100 text-slate-400 group-hover:text-primary-600 flex items-center justify-center transition">
            <Plus class="w-5 h-5" aria-hidden="true" />
          </span>
          <span class="text-xs font-bold text-slate-700 group-hover:text-primary-700 mt-2.5">
            新建一份针对性简历
          </span>
          <span class="text-2xs text-slate-500 mt-1">为不同岗位准备不同版本</span>
        </button>
        <button
          v-else
          type="button"
          class="w-full py-3 border-2 border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50/30 rounded-xl text-xs font-bold text-slate-600 hover:text-primary-700 transition flex items-center justify-center gap-2"
          @click="isCreateOpen = true"
        >
          <Plus class="w-4 h-4" aria-hidden="true" />
          <span>新建一份针对性简历</span>
        </button>
      </div>
    </main>

    <!-- 新建简历 -->
    <CreateResumeDialog
      v-model:open="isCreateOpen"
      :guest="!authStore.isLoggedIn"
      :creating="creating"
      :existing="resumes.map((item) => ({ id: item.id, title: item.title, templateId: item.templateId }))"
      @create="handleCreate"
      @guest-next="handleGuestNext"
    />

    <!-- 重命名 -->
    <AppModal v-model:open="renameOpen" size="sm" title="重命名简历">
      <form id="rename-form" @submit.prevent="submitRename">
        <FormField label="简历名称" id="rename-title" required :error="renameError">
          <template #default="{ id, describedBy, invalid }">
            <AppInput
              :id="id"
              v-model="renameValue"
              :invalid="invalid"
              :aria-describedby="describedBy"
              placeholder="如：前端工程师-张小凡"
              @input="renameError = ''"
            />
          </template>
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" :disabled="renaming" @click="renameTarget = null">取消</AppButton>
        <AppButton type="submit" form="rename-form" :loading="renaming">保存</AppButton>
      </template>
    </AppModal>

    <!-- 在线访问统计 -->
    <AppModal v-model:open="analyticsOpen" title="在线访问统计">
      <template #header>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Activity class="w-4 h-4" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-slate-900">在线访问统计</h2>
            <p class="text-2xs text-slate-500 truncate">{{ analyticsTarget?.title }}</p>
          </div>
        </div>
      </template>

      <div v-if="loadingAnalytics" class="space-y-3">
        <AppSkeleton height-class="h-16" />
        <AppSkeleton :lines="4" />
      </div>

      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="text-2xs text-slate-500">累计浏览</div>
            <div class="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {{ analyticsData?.totalViews || 0 }}
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="text-2xs text-slate-500">独立访客</div>
            <div class="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {{ analyticsData?.uniqueVisitors || 0 }}
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="text-2xs text-slate-500">平均停留</div>
            <div class="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {{ analyticsData?.avgDuration || 0 }}s
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="text-2xs text-slate-500">导出次数</div>
            <div class="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {{ analyticsData?.totalDownloads || 0 }}
            </div>
          </div>
        </div>

        <h3 class="text-xs font-bold text-slate-700 mt-5 mb-2">最近打开记录</h3>
        <ul v-if="analyticsData?.recentVisits?.length" class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          <li
            v-for="visit in analyticsData.recentVisits"
            :key="visit.id"
            class="p-2.5 bg-white rounded-lg border border-slate-100 flex items-center justify-between text-xs"
          >
            <span class="flex items-center gap-2 text-slate-600 min-w-0">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="visit.isDownloaded ? 'bg-success-500' : 'bg-primary-500'"
                aria-hidden="true"
              />
              <span class="truncate">
                {{ formatTime(visit.createdAt) }}
                <span v-if="visit.referer" class="text-slate-500"> · 来自 {{ visit.referer }}</span>
              </span>
            </span>
            <span class="flex items-center gap-2 text-slate-500 font-mono shrink-0">
              <span>{{ visit.duration }}s</span>
              <AppBadge v-if="visit.isDownloaded" tone="success">
                <Download class="w-3 h-3" aria-hidden="true" />
                已导出
              </AppBadge>
            </span>
          </li>
        </ul>
        <p v-else class="text-center py-8 text-xs text-slate-500 leading-relaxed">
          还没有访问记录。把在线只读链接发给 HR 后，这里会显示打开时间与停留时长。
        </p>

        <p class="text-2xs text-slate-500 mt-3 leading-relaxed">
          统计为估算值：已过滤常见爬虫与链接预览，同一访客 30 分钟内的重复刷新只计一次，
          单次停留上限 30 分钟。
        </p>
      </template>

      <template #footer>
        <AppButton variant="secondary" @click="isAnalyticsOpen = false">关闭</AppButton>
      </template>
    </AppModal>

    <!-- 分享设置 -->
    <ShareDialog
      v-if="shareTarget"
      v-model:open="shareDialogOpen"
      :resume-id="shareTarget.id"
      :resume-title="shareTarget.title"
      :is-public="shareTarget.isPublic"
      @update:is-public="onSharePublicChange"
    />

    <AuthModal :isOpen="isAuthModalOpen" @close="isAuthModalOpen = false" @success="load" />

    <AppFooter compact />
  </div>
</template>
