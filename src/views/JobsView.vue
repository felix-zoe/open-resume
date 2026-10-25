<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Navbar from '../components/Navbar.vue';
import AppFooter from '../components/AppFooter.vue';
import ApplicationDialog from '../components/jobs/ApplicationDialog.vue';
import { AppBadge, AppButton, AppCard, AppEmpty, AppMenu, AppSelect, AppSkeleton } from '../components/ui';
import { useApplications } from '../composables/useApplications';
import { apiFetch } from '../utils/http';
import { useToast } from '../composables/useToast';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type JobApplication
} from '../../shared/types';
import {
  AlarmClock,
  ExternalLink,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp
} from 'lucide-vue-next';

const toast = useToast();
const { items, stats, loading, errorMsg, loaded, busyId, load, create, update, remove } =
  useApplications();

// ---------------- 视图 ----------------
type ViewMode = 'board' | 'list';
const VIEW_KEY = 'open_resume_jobs_view';
const viewMode = ref<ViewMode>('board');

onMounted(() => {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === 'board' || saved === 'list') viewMode.value = saved;
  if (authReady()) void Promise.all([load(), loadResumeOptions()]);
});

function setView(next: ViewMode) {
  viewMode.value = next;
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* 隐私模式忽略 */
  }
}

/** 未登录时路由守卫会拦下，这里只防御「令牌被清空但页面还在」 */
function authReady(): boolean {
  try {
    return Boolean(localStorage.getItem('open_resume_token'));
  } catch {
    return false;
  }
}

// ---------------- 简历选项（关联投递用哪份简历） ----------------
const resumeOptions = ref<Array<{ id: string; title: string }>>([]);

async function loadResumeOptions() {
  const result = await apiFetch<Array<{ id: string; title: string }>>('/api/resumes');
  if (result.ok && Array.isArray(result.data)) {
    resumeOptions.value = result.data.map((row) => ({ id: row.id, title: row.title }));
  }
}

// ---------------- 新增 / 编辑 ----------------
const isDialogOpen = ref(false);
const editing = ref<JobApplication | null>(null);
const submitting = ref(false);

function openCreate() {
  editing.value = null;
  isDialogOpen.value = true;
}

function openEdit(item: JobApplication) {
  editing.value = item;
  isDialogOpen.value = true;
}

async function handleSubmit(payload: Record<string, unknown>) {
  submitting.value = true;
  try {
    const ok = editing.value
      ? await update(editing.value.id, payload as Partial<JobApplication>)
      : await create(payload as Partial<JobApplication>);
    if (ok) isDialogOpen.value = false;
  } finally {
    submitting.value = false;
  }
}

// ---------------- 状态切换 ----------------
const STATUS_TONE: Record<ApplicationStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'danger'> = {
  saved: 'neutral',
  applied: 'primary',
  interviewing: 'warning',
  offer: 'success',
  rejected: 'danger'
};

const BOARD_COLUMNS = APPLICATION_STATUSES;

async function moveTo(item: JobApplication, status: ApplicationStatus) {
  const result = await update(item.id, {
    status,
    // 从「想投」变成「已投递」时补上今天，时间线才有起点
    ...(status === 'applied' && !item.appliedAt
      ? { appliedAt: Math.floor(Date.now() / 1000) }
      : {})
  });
  if (result) toast.success(`已移到「${APPLICATION_STATUS_LABELS[status]}」`);
}

async function handleDelete(item: JobApplication) {
  await remove(item);
}

// ---------------- 跟进提醒 ----------------
const now = ref(Math.floor(Date.now() / 1000));

const dueList = computed(() =>
  items.value
    .filter(
      (item) =>
        item.nextActionAt &&
        item.status !== 'offer' &&
        item.status !== 'rejected' &&
        Number(item.nextActionAt) <= now.value + 7 * 24 * 3600
    )
    .sort((a, b) => Number(a.nextActionAt) - Number(b.nextActionAt))
    .slice(0, 5)
);

function daysUntil(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const diff = Math.round((seconds - now.value) / 86400);
  if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
  if (diff === 0) return '今天';
  return `${diff} 天后`;
}

function formatDate(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const date = new Date(seconds * 1000);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

// ---------------- 筛选 ----------------
const filterResume = ref('');
const resumeFilterOptions = computed(() => [
  { value: '', label: '全部简历' },
  ...resumeOptions.value.map((row) => ({ value: row.id, label: row.title }))
]);

const visibleItems = computed(() =>
  filterResume.value ? items.value.filter((row) => row.resumeId === filterResume.value) : items.value
);

const visibleByStatus = computed(() => {
  const groups: Record<ApplicationStatus, JobApplication[]> = {
    saved: [],
    applied: [],
    interviewing: [],
    offer: [],
    rejected: []
  };
  for (const item of visibleItems.value) (groups[item.status] ?? groups.applied).push(item);
  return groups;
});

const openMenuId = ref<string | null>(null);
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <Navbar />

    <main id="main-content" tabindex="-1" class="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
      <header class="mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900">投递管理</h1>
            <p class="text-xs text-slate-500 mt-1">
              记录投了哪家、用的哪份简历、进展到哪一步，避免跟进时想不起来
            </p>
          </div>
          <AppButton @click="openCreate">
            <template #icon>
              <Plus class="w-4 h-4" aria-hidden="true" />
            </template>
            <span>添加投递</span>
          </AppButton>
        </div>

        <!-- 汇总：面试率与 Offer 率的分母都是「已投递」，不含「想投」 -->
        <dl v-if="stats && stats.total > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">已投递</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ stats.applied }}</dd>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">面试率</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ stats.interviewRate }}%</dd>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">Offer 率</dt>
            <dd class="text-lg font-bold text-slate-900 font-mono mt-0.5">{{ stats.offerRate }}%</dd>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
            <dt class="text-2xs text-slate-500">待跟进</dt>
            <dd
              class="text-lg font-bold font-mono mt-0.5"
              :class="stats.dueSoon > 0 ? 'text-warning-600' : 'text-slate-900'"
            >
              {{ stats.dueSoon }}
            </dd>
          </div>
        </dl>
      </header>

      <!-- 跟进提醒 -->
      <AppCard v-if="dueList.length" class="mb-5 border-warning-200 bg-warning-50/40">
        <div class="flex items-start gap-2.5">
          <AlarmClock class="w-4 h-4 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-800">近期需要跟进</p>
            <ul class="mt-2 space-y-1.5">
              <li
                v-for="item in dueList"
                :key="item.id"
                class="text-2xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <span class="font-semibold text-slate-800">{{ item.company }}</span>
                <span>{{ item.position }}</span>
                <span class="text-slate-300" aria-hidden="true">·</span>
                <span
                  :class="
                    Number(item.nextActionAt) < now ? 'text-danger-600 font-semibold' : 'text-warning-700'
                  "
                >
                  {{ formatDate(item.nextActionAt) }}（{{ daysUntil(item.nextActionAt) }}）
                </span>
                <span v-if="item.nextActionNote" class="text-slate-500">{{ item.nextActionNote }}</span>
              </li>
            </ul>
          </div>
        </div>
      </AppCard>

      <!-- 工具条 -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
        <div class="w-full sm:w-52">
          <AppSelect
            :model-value="filterResume"
            :options="resumeFilterOptions"
            aria-label="按简历筛选"
            @update:model-value="filterResume = $event"
          />
        </div>

        <div
          class="hidden sm:inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0 sm:ml-auto"
          role="group"
          aria-label="切换视图"
        >
          <button
            type="button"
            class="p-1.5 rounded-md transition"
            :class="viewMode === 'board' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'"
            aria-label="看板视图"
            :aria-pressed="viewMode === 'board'"
            @click="setView('board')"
          >
            <LayoutGrid class="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="p-1.5 rounded-md transition"
            :class="viewMode === 'list' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'"
            aria-label="列表视图"
            :aria-pressed="viewMode === 'list'"
            @click="setView('list')"
          >
            <List class="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- 加载 / 错误 / 空态 -->
      <div v-if="loading && !loaded" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AppCard v-for="i in 3" :key="i">
          <AppSkeleton height-class="h-3" class="w-1/3" />
          <AppSkeleton height-class="h-4" class="mt-3 w-3/4" />
          <AppSkeleton height-class="h-8" class="mt-3" />
        </AppCard>
      </div>

      <AppCard v-else-if="errorMsg" class="text-center py-10">
        <p class="text-sm font-semibold text-slate-800">加载失败</p>
        <p class="text-xs text-slate-500 mt-1">{{ errorMsg }}</p>
        <AppButton variant="secondary" class="mt-4" @click="load">重试</AppButton>
      </AppCard>

      <AppEmpty
        v-else-if="loaded && !items.length"
        title="还没有投递记录"
        description="把投过的岗位记下来：投了哪家、用的哪份简历、进展到哪一步。跟进时不用再翻邮箱。"
      >
        <template #action>
          <AppButton @click="openCreate">
            <template #icon>
              <Plus class="w-4 h-4" aria-hidden="true" />
            </template>
            <span>添加第一条记录</span>
          </AppButton>
        </template>
      </AppEmpty>

      <AppEmpty
        v-else-if="loaded && !visibleItems.length"
        title="该简历还没有投递记录"
        description="换一份简历，或先把筛选清空。"
      >
        <template #action>
          <AppButton variant="secondary" @click="filterResume = ''">查看全部</AppButton>
        </template>
      </AppEmpty>

      <!-- 看板视图 -->
      <div v-else-if="viewMode === 'board'" class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <section
          v-for="status in BOARD_COLUMNS"
          :key="status"
          class="bg-slate-100/70 rounded-xl p-2.5 min-h-[120px]"
          :aria-label="`${APPLICATION_STATUS_LABELS[status]} 列`"
        >
          <h2 class="text-2xs font-bold text-slate-600 px-1 mb-2 flex items-center justify-between">
            <span>{{ APPLICATION_STATUS_LABELS[status] }}</span>
            <span class="font-mono text-slate-400">{{ visibleByStatus[status].length }}</span>
          </h2>

          <ul class="space-y-2">
            <li
              v-for="item in visibleByStatus[status]"
              :key="item.id"
              class="bg-white border border-slate-200 rounded-lg p-2.5 transition"
              :class="busyId === item.id && 'opacity-60'"
            >
              <div class="flex items-start justify-between gap-1.5">
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-900 truncate" :title="item.company">
                    {{ item.company }}
                  </p>
                  <p class="text-2xs text-slate-500 truncate" :title="item.position">
                    {{ item.position }}
                  </p>
                </div>
                <AppMenu
                  :open="openMenuId === item.id"
                  aria-label="投递记录操作"
                  width-class="w-40"
                  @update:open="openMenuId = $event ? item.id : null"
                >
                  <template #trigger="{ open }">
                    <button
                      type="button"
                      class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      aria-label="更多操作"
                      :aria-expanded="open"
                      @click.stop="openMenuId = open ? null : item.id"
                    >
                      <MoreHorizontal class="w-3.5 h-3.5" />
                    </button>
                  </template>
                  <button
                    type="button"
                    role="menuitem"
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    @click="openMenuId = null; openEdit(item)"
                  >
                    <Pencil class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>编辑</span>
                  </button>
                  <button
                    v-for="next in BOARD_COLUMNS.filter((s) => s !== item.status)"
                    :key="next"
                    type="button"
                    role="menuitem"
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    @click="openMenuId = null; moveTo(item, next)"
                  >
                    <TrendingUp class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>移到{{ APPLICATION_STATUS_LABELS[next] }}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-600 hover:bg-danger-50"
                    @click="openMenuId = null; handleDelete(item)"
                  >
                    <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                    <span>删除</span>
                  </button>
                </AppMenu>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <AppBadge :tone="STATUS_TONE[item.status]">{{ APPLICATION_STATUS_LABELS[item.status] }}</AppBadge>
                <span v-if="item.resumeTitle" class="text-2xs text-slate-500 truncate max-w-full">
                  {{ item.resumeTitle }}
                </span>
              </div>

              <p class="mt-1.5 text-2xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span>{{ formatDate(item.appliedAt) }}</span>
                <template v-if="item.nextActionAt">
                  <span class="text-slate-300" aria-hidden="true">·</span>
                  <span
                    :class="
                      item.status === 'offer' || item.status === 'rejected'
                        ? 'text-slate-500'
                        : 'text-warning-700'
                    "
                  >
                    跟进 {{ formatDate(item.nextActionAt) }}
                  </span>
                </template>
              </p>
            </li>
          </ul>
        </section>
      </div>

      <!-- 列表视图 -->
      <ul v-else class="space-y-2">
        <li
          v-for="item in visibleItems"
          :key="item.id"
          class="bg-white border border-slate-200 rounded-xl px-3.5 py-3 flex items-center gap-3 transition hover:border-slate-300"
          :class="busyId === item.id && 'opacity-60'"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-slate-900 truncate">{{ item.company }}</span>
              <span class="text-2xs text-slate-500 truncate">{{ item.position }}</span>
              <AppBadge :tone="STATUS_TONE[item.status]">
                {{ APPLICATION_STATUS_LABELS[item.status] }}
              </AppBadge>
            </div>
            <p class="text-2xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>投递 {{ formatDate(item.appliedAt) }}</span>
              <template v-if="item.resumeTitle">
                <span class="text-slate-300" aria-hidden="true">·</span>
                <span>{{ item.resumeTitle }}</span>
              </template>
              <template v-if="item.nextActionAt">
                <span class="text-slate-300" aria-hidden="true">·</span>
                <span class="text-warning-700">跟进 {{ formatDate(item.nextActionAt) }}</span>
              </template>
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <a
              v-if="item.jobUrl"
              :href="item.jobUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="打开岗位链接"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="编辑"
              @click="openEdit(item)"
            >
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition"
              aria-label="删除"
              @click="handleDelete(item)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </li>
      </ul>

      <!-- 统计口径说明：写清楚分母，避免用户误读 -->
      <p v-if="stats && stats.total > 0" class="text-2xs text-slate-500 mt-5 leading-relaxed">
        面试率与 Offer 率的分母是「已投递」（不含「想投」）；已录用与未通过的记录不再进入跟进提醒。
      </p>
    </main>

    <ApplicationDialog
      v-model:open="isDialogOpen"
      :item="editing"
      :resumes="resumeOptions"
      :submitting="submitting"
      @submit="handleSubmit"
    />

    <AppFooter compact />
  </div>
</template>
