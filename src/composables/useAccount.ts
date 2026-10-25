import { ref } from 'vue';
import { apiFetch } from '../utils/http';

/**
 * 账号自助管理（T5.5）。
 *
 * 三件事都是「不可逆或半不可逆」的操作，所以：
 * · 每个函数都返回 `ApiResult`，由页面决定怎么提示，不在 composable 里弹 toast；
 * · 注销的二次确认放在页面（要求输入邮箱），这里只负责发请求；
 * · 导出直接生成文件下载，不经过弹窗——用户点「导出」就是要拿到文件。
 */

export interface AccountExportPayload {
  format: string;
  version: number;
  exportedAt: number;
  account: { id: string; email: string; nickname: string | null; createdAt: number | null };
  counts: { resumes: number; versions: number; shareLinks: number; applications: number };
  resumes: unknown[];
  versions: unknown[];
  shareLinks: unknown[];
  applications: unknown[];
}

export interface DeletionState {
  deletionRequestedAt: number | null;
  deletionDaysLeft: number | null;
}

export function useAccount() {
  const isSubmitting = ref(false);

  async function changePassword(currentPassword: string, newPassword: string) {
    return apiFetch<null>('/api/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
  }

  /**
   * 拉取导出数据并触发下载。
   *
   * 不用 `<a href="/api/auth/export">` 直接下载：那条路径不带 Authorization 头，
   * 浏览器会拿到 401 存成一个「失败页面」文件。必须走 fetch 再构造 Blob。
   */
  async function downloadExport(): Promise<{ ok: boolean; message: string; filename?: string }> {
    isSubmitting.value = true;
    try {
      const result = await apiFetch<AccountExportPayload>('/api/auth/export');
      if (!result.ok || !result.data) {
        return { ok: false, message: result.message || '导出失败，请稍后重试' };
      }

      const filename = buildFileName(result.data.account.email);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // 立即 revoke 会让部分浏览器的下载中断，等一帧再释放
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { ok: true, message: '数据已导出', filename };
    } finally {
      isSubmitting.value = false;
    }
  }

  async function requestDeletion(email: string) {
    return apiFetch<DeletionState>('/api/auth/deletion', {
      method: 'POST',
      body: { email }
    });
  }

  async function cancelDeletion() {
    return apiFetch<null>('/api/auth/deletion', { method: 'DELETE' });
  }

  return {
    isSubmitting,
    changePassword,
    downloadExport,
    requestDeletion,
    cancelDeletion
  };
}

/** 与服务端 `exportFileName()` 保持同样的清洗规则，避免两边文件名不一致 */
function buildFileName(email: string): string {
  const safe = String(email || 'account')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  return `openresume-${safe || 'account'}-${stamp}.json`;
}
