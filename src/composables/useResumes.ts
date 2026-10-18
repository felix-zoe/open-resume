import { computed, ref } from 'vue';
import { apiFetch } from '../utils/http';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import { useToast } from './useToast';
import { askConfirm } from './useConfirm';

export interface ResumeStats {
  totalViews: number;
  avgDuration: number;
  totalDownloads: number;
}

export interface ResumeSummary {
  id: string;
  title: string;
  templateId: string;
  isPublic?: number;
  createdAt?: string | number;
  updatedAt: string | number;
  stats: ResumeStats;
}

export interface OverviewRow {
  resumeId: string;
  totalViews: number;
  avgDuration: number;
  totalDownloads: number;
}

const EMPTY_STATS: ResumeStats = { totalViews: 0, avgDuration: 0, totalDownloads: 0 };

function normalizeList(raw: unknown): Array<Omit<ResumeSummary, 'stats'>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is Omit<ResumeSummary, 'stats'> =>
      !!row && typeof row === 'object' && typeof (row as any).id === 'string'
  );
}

function normalizeOverview(raw: unknown): Map<string, ResumeStats> {
  const map = new Map<string, ResumeStats>();
  if (!Array.isArray(raw)) return map;
  for (const row of raw as OverviewRow[]) {
    if (!row || typeof row.resumeId !== 'string') continue;
    map.set(row.resumeId, {
      totalViews: Number(row.totalViews) || 0,
      avgDuration: Math.round(Number(row.avgDuration) || 0),
      totalDownloads: Number(row.totalDownloads) || 0
    });
  }
  return map;
}

/**
 * Dashboard 的数据层。
 *
 * 关键点：列表与访问汇总并行拉取（`Promise.all`），一次请求覆盖全部简历，
 * 不再对每份简历各发一次 `/resumes/:id/analytics`（N+1）。
 */
export function useResumes() {
  const toast = useToast();

  const resumes = ref<ResumeSummary[]>([]);
  const loading = ref(false);
  const errorMsg = ref('');
  const loaded = ref(false);
  /** 正在处理中的简历 id，用于禁用单卡片操作 */
  const busyId = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    errorMsg.value = '';
    try {
      const [listResult, overviewResult] = await Promise.all([
        apiFetch<unknown>('/api/resumes'),
        apiFetch<unknown>('/api/analytics/overview')
      ]);

      if (!listResult.ok) {
        errorMsg.value = listResult.message || '加载简历列表失败';
        return;
      }

      // 汇总接口失败不应让整页失败：降级为 0 数据
      const overview = normalizeOverview(overviewResult.ok ? overviewResult.data : null);

      resumes.value = normalizeList(listResult.data).map((item) => ({
        ...item,
        stats: overview.get(item.id) ?? { ...EMPTY_STATS }
      }));
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  /** 只改标题：走 PATCH，避免 PUT 缺正文把内容覆盖成 {} */
  async function rename(item: ResumeSummary, nextTitle: string): Promise<boolean> {
    const title = nextTitle.trim();
    if (!title) {
      toast.error('标题不能为空');
      return false;
    }
    if (title.length > 100) {
      toast.error('标题不能超过 100 个字符');
      return false;
    }
    if (title === item.title) return true;

    busyId.value = item.id;
    const previous = item.title;
    item.title = title; // 乐观更新
    try {
      const result = await apiFetch<{ id: string; title: string; updatedAt: number }>(
        `/api/resumes/${item.id}`,
        { method: 'PATCH', body: { title } }
      );
      if (!result.ok) {
        item.title = previous;
        toast.error(result.message || '重命名失败');
        return false;
      }
      if (result.data?.updatedAt) item.updatedAt = result.data.updatedAt;
      toast.success('已重命名');
      return true;
    } finally {
      busyId.value = null;
    }
  }

  async function toggleShare(item: ResumeSummary): Promise<void> {
    const nextPublic = item.isPublic === 1 ? 0 : 1;
    const previous = item.isPublic;
    item.isPublic = nextPublic;
    busyId.value = item.id;
    try {
      const result = await apiFetch(`/api/resumes/${item.id}/share`, {
        method: 'POST',
        body: { isPublic: nextPublic }
      });
      if (!result.ok) {
        item.isPublic = previous;
        toast.error(result.message || '更新分享设置失败');
      }
    } finally {
      busyId.value = null;
    }
  }

  async function duplicate(item: ResumeSummary): Promise<ResumeSummary | null> {
    busyId.value = item.id;
    try {
      const detail = await apiFetch<any>(`/api/resumes/${item.id}`);
      if (!detail.ok || !detail.data) {
        toast.error(detail.message || '读取原简历失败');
        return null;
      }
      const result = await apiFetch<{ id: string }>('/api/resumes', {
        method: 'POST',
        body: {
          title: `${item.title}_副本`,
          templateId: detail.data.templateId || item.templateId,
          content: detail.data.content || DEFAULT_RESUME_CONTENT,
          themeConfig: detail.data.themeConfig || DEFAULT_THEME_CONFIG
        }
      });
      if (!result.ok || !result.data?.id) {
        toast.error(result.message || '复制失败');
        return null;
      }
      await load();
      toast.success('已创建副本');
      const created = resumes.value.find((row) => row.id === result.data!.id) ?? null;
      return created;
    } finally {
      busyId.value = null;
    }
  }

  async function remove(item: ResumeSummary): Promise<boolean> {
    const confirmed = await askConfirm({
      title: '删除这份简历？',
      description: '删除后无法恢复，已生成的分享链接也会立即失效。',
      confirmText: '删除',
      tone: 'danger'
    });
    if (!confirmed) return false;

    busyId.value = item.id;
    try {
      const result = await apiFetch(`/api/resumes/${item.id}`, { method: 'DELETE' });
      if (!result.ok) {
        toast.error(result.message || '删除失败');
        return false;
      }
      resumes.value = resumes.value.filter((row) => row.id !== item.id);
      toast.success('已删除');
      return true;
    } finally {
      busyId.value = null;
    }
  }

  const isEmpty = computed(() => loaded.value && resumes.value.length === 0);

  const totals = computed(() =>
    resumes.value.reduce(
      (acc, item) => ({
        views: acc.views + item.stats.totalViews,
        downloads: acc.downloads + item.stats.totalDownloads
      }),
      { views: 0, downloads: 0 }
    )
  );

  return {
    resumes,
    loading,
    errorMsg,
    loaded,
    busyId,
    isEmpty,
    totals,
    load,
    rename,
    toggleShare,
    duplicate,
    remove
  };
}
