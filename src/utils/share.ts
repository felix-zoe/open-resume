/**
 * 分享链接的前端辅助函数。
 *
 * 放在 utils 而不是组件里，是为了让「有效期文案」「状态标签」这类
 * 容易被写歪的映射能被单测直接覆盖。
 */

export type ShareTtl = '7d' | '30d' | 'permanent';
export type ShareStatus = 'ok' | 'revoked' | 'expired' | 'needs-password';

export interface ShareLink {
  id: string;
  token: string;
  label: string;
  url: string;
  expiresAt: number | null;
  allowDownload: boolean;
  maskContact: boolean;
  hasPassword: boolean;
  revokedAt: number | null;
  viewCount: number;
  lastViewedAt: number | null;
  createdAt: number;
  status: ShareStatus;
}

export const SHARE_TTL_OPTIONS: Array<{ value: ShareTtl; label: string }> = [
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'permanent', label: '永久有效' }
];

/** 拼出可直接发给 HR 的绝对地址；`origin` 可注入便于测试 */
export function absoluteShareUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  return `${base}/s/${token}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 秒级时间戳 → `YYYY-MM-DD` */
export function formatDate(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 有效期文案。
 * 刻意区分「已过期」与「永久有效」——前者需要用户重新生成，后者不需要任何操作。
 */
export function formatExpiry(
  expiresAt: number | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  if (expiresAt === null || expiresAt === undefined) return '永久有效';
  if (expiresAt <= nowSeconds) return '已过期';
  return `${formatDate(expiresAt)} 到期`;
}

export function shareStatusLabel(status: ShareStatus): string {
  switch (status) {
    case 'expired':
      return '已过期';
    case 'revoked':
      return '已撤销';
    case 'needs-password':
      return '待解锁';
    default:
      return '生效中';
  }
}

export function shareStatusTone(status: ShareStatus): 'success' | 'warning' | 'neutral' | 'primary' {
  switch (status) {
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'neutral';
    case 'needs-password':
      return 'primary';
    default:
      return 'success';
  }
}

/** 已撤销/已过期的链接不能再复制，避免把死链发给 HR */
export function isLinkUsable(link: Pick<ShareLink, 'status'>): boolean {
  return link.status !== 'revoked' && link.status !== 'expired';
}
