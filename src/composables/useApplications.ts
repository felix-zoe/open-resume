import { ref } from 'vue';
import { apiFetch } from '../utils/http';
import { useToast } from './useToast';
import { askConfirm } from './useConfirm';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStats,
  type ApplicationStatus,
  type JobApplication
} from '../../shared/types';

/**
 * 投递记录的数据层。
 *
 * 列表与统计一次拿回（服务端已经算好），不在前端重复算口径 ——
 * 「面试率的分母是已投递还是全部记录」这种问题只能有一个答案。
 */
export function useApplications() {
  const toast = useToast();

  const items = ref<JobApplication[]>([]);
  const stats = ref<ApplicationStats | null>(null);
  const loading = ref(false);
  const errorMsg = ref('');
  const loaded = ref(false);
  const busyId = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    errorMsg.value = '';
    try {
      const result = await apiFetch<{ items: JobApplication[]; stats: ApplicationStats }>('/api/jobs');
      if (!result.ok || !result.data) {
        errorMsg.value = result.message || '加载投递记录失败';
        return;
      }
      items.value = Array.isArray(result.data.items) ? result.data.items : [];
      stats.value = result.data.stats ?? null;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function create(payload: Partial<JobApplication>): Promise<boolean> {
    const result = await apiFetch<{ id: string }>('/api/jobs', {
      method: 'POST',
      body: payload
    });
    if (!result.ok) {
      toast.error(result.message || '添加失败');
      return false;
    }
    await load();
    toast.success('已添加投递记录');
    return true;
  }

  async function update(id: string, patch: Partial<JobApplication>): Promise<boolean> {
    busyId.value = id;
    try {
      const result = await apiFetch(`/api/jobs/${id}`, { method: 'PATCH', body: patch });
      if (!result.ok) {
        toast.error(result.message || '更新失败');
        return false;
      }
      await load();
      return true;
    } finally {
      busyId.value = null;
    }
  }

  /** 看板上拖动/点选状态时调用：只改状态，不碰其他字段 */
  async function changeStatus(item: JobApplication, status: ApplicationStatus): Promise<void> {
    if (item.status === status) return;
    // 从「想投」变成「已投递」时补上投递日期，否则时间线缺起点
    const patch: Partial<JobApplication> = { status };
    if (status === 'applied' && !item.appliedAt) {
      patch.appliedAt = Math.floor(Date.now() / 1000);
    }
    const ok = await update(item.id, patch);
    if (ok) toast.success(`已标记为「${APPLICATION_STATUS_LABELS[status]}」`);
  }

  async function remove(item: JobApplication): Promise<boolean> {
    const confirmed = await askConfirm({
      title: '删除这条投递记录？',
      description: `${item.company} · ${item.position}。删除后无法恢复，但不会影响简历本身。`,
      confirmText: '删除',
      tone: 'danger'
    });
    if (!confirmed) return false;

    busyId.value = item.id;
    try {
      const result = await apiFetch(`/api/jobs/${item.id}`, { method: 'DELETE' });
      if (!result.ok) {
        toast.error(result.message || '删除失败');
        return false;
      }
      items.value = items.value.filter((row) => row.id !== item.id);
      toast.success('已删除');
      // 统计口径变了，重新拉一次比在前端重算更可靠
      await load();
      return true;
    } finally {
      busyId.value = null;
    }
  }

  return {
    items,
    stats,
    loading,
    errorMsg,
    loaded,
    busyId,
    load,
    create,
    update,
    changeStatus,
    remove
  };
}
