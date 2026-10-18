<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AuthModal from '../components/AuthModal.vue';
import CreateResumeDialog from '../components/dashboard/CreateResumeDialog.vue';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmpty,
  AppInput,
  AppMenu,
  AppModal,
  AppSelect,
  AppSkeleton,
  FormField
} from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useResumes, type ResumeSummary } from '../composables/useResumes';
import { apiFetch } from '../utils/http';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import { useToast } from '../composables/useToast';
import { findTemplate } from '../constants/templates';
import {
  Activity,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  TrendingUp,
  Trash2
} from 'lucide-vue-next';

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

async function handleCreate(payload: { templateId: string; title: string }) {
  creating.value = true;
  try {
    const result = await apiFetch<{ id: string }>('/api/resumes', {
      method: 'POST',
      body: {
        title: payload.title,
        templateId: payload.templateId,
        content: DEFAULT_RESUME_CONTENT,
        themeConfig: DEFAULT_THEME_CONFIG
      }
    });
    if (!result.ok || !result.data?.id) {
      toast.error(result.message || '新建简历失败');
      return;
    }
    isCreateOpen.value = false;
    router.push(`/editor/${result.data.id}`);
  } finally {
    creating.value = false;
  }
}

function handleGuestNext(payload: { templateId: string }) {
  isCreateOpen.value = false;
  router.push({ path: '/editor/new', query: { template: payload.templateId } });
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

async function copyShareLink(item: ResumeSummary) {
  if (item.isPublic !== 1) {
    toast.info('请先开启公开分享，再复制链接');
    return;
  }
  const url = `${window.location.origin}/share/${item.id}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success('只读分享链接已复制');
  } catch {
    toast.copyFallback('浏览器阻止了剪贴板写入，请手动复制链接', url);
  }
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

// ---------------- 阅读足迹 ----------------
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
          <AppButton @click="isCreateOpen = true">
            <template #icon>
              <Plus class="w-4 h-4" aria-hidden="true" />
            </template>
            <span>新建简历</span>
          </AppButton>
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
      </div>

      <!-- 加载骨架 -->
      <div v-if="loading && !resumes.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        description="新建一份简历只需三步：选择模板、填写名称、开始编辑。内容会自动保存。"
      >
        <template #action>
          <AppButton @click="isCreateOpen = true">
            <template #icon>
              <Plus class="w-4 h-4" aria-hidden="true" />
            </template>
            <span>新建第一份简历</span>
          </AppButton>
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

      <!-- 简历网格 -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AppCard
          v-for="item in visibleResumes"
          :key="item.id"
          class="flex flex-col"
          :class="busyId === item.id && 'opacity-70'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5 min-w-0">
              <AppBadge tone="neutral">{{ findTemplate(item.templateId).shortName }}</AppBadge>
              <AppBadge :tone="item.isPublic === 1 ? 'success' : 'neutral'" dot>
                <component :is="item.isPublic === 1 ? Globe : Lock" class="w-3 h-3" aria-hidden="true" />
                {{ item.isPublic === 1 ? '公开' : '私有' }}
              </AppBadge>
            </div>

            <AppMenu
              :open="openMenuId === item.id"
              aria-label="简历操作"
              @update:open="openMenuId = $event ? item.id : null"
            >
              <template #trigger="{ open }">
                <button
                  type="button"
                  class="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  aria-label="更多操作"
                  :aria-expanded="open"
                  @click.stop="openMenuId = open ? null : item.id"
                >
                  <MoreHorizontal class="w-4 h-4" />
                </button>
              </template>

              <button
                type="button"
                role="menuitem"
                class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                @click="openRename(item)"
              >
                <Edit3 class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>重命名</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                @click="handleDuplicate(item)"
              >
                <Copy class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>复制一份副本</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-600 hover:bg-danger-50"
                @click="handleDelete(item)"
              >
                <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                <span>删除</span>
              </button>
            </AppMenu>
          </div>

          <h2 class="text-sm font-bold text-slate-900 mt-3 truncate" :title="item.title">
            {{ item.title }}
          </h2>
          <p class="text-2xs text-slate-500 mt-1 flex items-center gap-1.5">
            <FileText class="w-3 h-3" aria-hidden="true" />
            <span>更新于 {{ formatTime(item.updatedAt) }}</span>
          </p>

          <!-- 阅读数据 -->
          <button
            type="button"
            class="mt-3 p-2.5 rounded-lg bg-slate-50 hover:bg-primary-50/60 border border-slate-100 text-left transition"
            @click="openAnalytics(item)"
          >
            <div class="flex items-center gap-3 text-2xs text-slate-600">
              <span class="flex items-center gap-1">
                <Eye class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span class="font-bold font-mono">{{ item.stats.totalViews }}</span> 浏览
              </span>
              <span class="flex items-center gap-1">
                <Activity class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span class="font-bold font-mono">{{ item.stats.avgDuration }}s</span> 均长
              </span>
              <span class="flex items-center gap-1 ml-auto text-primary-600 font-semibold">
                <TrendingUp class="w-3 h-3" aria-hidden="true" />
                <span>足迹</span>
              </span>
            </div>
          </button>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <router-link
              :to="`/editor/${item.id}`"
              class="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition"
            >
              <Edit3 class="w-3.5 h-3.5" aria-hidden="true" />
              <span>编辑</span>
            </router-link>

            <div class="flex items-center gap-1">
              <button
                type="button"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                :aria-label="item.isPublic === 1 ? '关闭公开分享' : '开启公开分享'"
                @click="toggleShare(item)"
              >
                <component :is="item.isPublic === 1 ? Globe : Lock" class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="复制分享链接"
                @click="copyShareLink(item)"
              >
                <Share2 class="w-3.5 h-3.5" />
              </button>
              <router-link
                :to="`/share/${item.id}`"
                target="_blank"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="打开在线只读页"
              >
                <ExternalLink class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </div>
        </AppCard>

        <!-- 新建卡片 -->
        <button
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
      </div>
    </main>

    <!-- 新建简历 -->
    <CreateResumeDialog
      v-model:open="isCreateOpen"
      :guest="!authStore.isLoggedIn"
      :creating="creating"
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

    <!-- 阅读足迹 -->
    <AppModal v-model:open="analyticsOpen" title="阅读足迹">
      <template #header>
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Activity class="w-4 h-4" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-slate-900">阅读足迹</h2>
            <p class="text-2xs text-slate-500 truncate">{{ analyticsTarget?.title }}</p>
          </div>
        </div>
      </template>

      <div v-if="loadingAnalytics" class="space-y-3">
        <AppSkeleton height-class="h-16" />
        <AppSkeleton :lines="4" />
      </div>

      <template v-else>
        <div class="grid grid-cols-3 gap-2.5 text-center">
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div class="text-2xs text-slate-500">累计浏览</div>
            <div class="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {{ analyticsData?.totalViews || 0 }}
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
            <span class="flex items-center gap-2 text-slate-600">
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="visit.isDownloaded ? 'bg-success-500' : 'bg-primary-500'"
                aria-hidden="true"
              />
              {{ formatTime(visit.createdAt) }}
            </span>
            <span class="flex items-center gap-2 text-slate-500 font-mono">
              <span>{{ visit.duration }}s</span>
              <AppBadge v-if="visit.isDownloaded" tone="success">
                <Download class="w-3 h-3" aria-hidden="true" />
                已导出
              </AppBadge>
            </span>
          </li>
        </ul>
        <p v-else class="text-center py-8 text-xs text-slate-500 leading-relaxed">
          还没有阅读记录。把在线只读链接发给 HR 后，这里会显示打开时间与停留时长。
        </p>
      </template>

      <template #footer>
        <AppButton variant="secondary" @click="isAnalyticsOpen = false">关闭</AppButton>
      </template>
    </AppModal>

    <AuthModal :isOpen="isAuthModalOpen" @close="isAuthModalOpen = false" @success="load" />
  </div>
</template>
