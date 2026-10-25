/**
 * 账号生命周期相关的纯函数。
 *
 * 抽出来的原因与 security.ts / share.ts 一致：注销冷静期是**对用户的数据承诺**
 * （「7 天内后悔还来得及」），必须能被 Vitest 直接覆盖，而不是埋在路由里靠点页面验证。
 */

/** 注销冷静期：7 天。期间登录即自动撤销。 */
export const DELETION_GRACE_SECONDS = 7 * 24 * 3600;

/** 冷静期还剩几天（向上取整）；未申请注销返回 null */
export function deletionDaysLeft(
  requestedAt: number | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): number | null {
  if (!requestedAt || !Number.isFinite(requestedAt)) return null;
  const remaining = requestedAt + DELETION_GRACE_SECONDS - nowSeconds;
  return remaining > 0 ? Math.ceil(remaining / 86400) : 0;
}

/** 冷静期是否已过（可以执行真正的删除） */
export function isDeletionDue(
  requestedAt: number | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!requestedAt || !Number.isFinite(requestedAt)) return false;
  return requestedAt + DELETION_GRACE_SECONDS <= nowSeconds;
}

/** 是否处于冷静期内（已申请、尚未到期） */
export function isInGracePeriod(
  requestedAt: number | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  return deletionDaysLeft(requestedAt, nowSeconds) !== null && !isDeletionDue(requestedAt, nowSeconds);
}

/**
 * 数据保留策略。
 *
 * 与方案 4.2.10 的「访问记录 180 天、版本 20 个」对齐：
 * 前者由清理脚本按 `created_at` 删除，后者在写版本时截断（见 versions.ts）。
 */
export const RETENTION = {
  /** 访问记录保留天数 */
  visitDays: 180,
  /** 每份简历保留的版本数（与 versions.ts 的 VERSION_KEEP_LIMIT 一致） */
  versionCount: 20
} as const;

/** 访问记录的过期阈值（秒），供清理 SQL 使用 */
export function visitRetentionCutoff(nowSeconds = Math.floor(Date.now() / 1000)): number {
  return nowSeconds - RETENTION.visitDays * 86400;
}

/**
 * 导出文件的文件名。
 *
 * 用户邮箱里可能带 `+`、`.`、`@`，直接拼进文件名会被各平台转义成 `%2B`，
 * 下载下来是一串乱码。只保留字母数字与 `-`，其余一律替换成 `-`。
 */
export function exportFileName(email: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const safe = String(email || 'account')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const stamp = new Date(nowSeconds * 1000).toISOString().slice(0, 10);
  return `openresume-${safe || 'account'}-${stamp}.json`;
}

/**
 * 组装账号导出数据。
 *
 * 只导出**用户自己的**内容：简历、主题、版本历史、分享链接、投递记录。
 * 不含访问统计（那是别人的浏览行为，不是用户的数据）。
 * 也不含 `password_hash` —— 导出包里出现密码哈希只会增加泄露面。
 */
export function buildAccountExport(input: {
  user: { id: string; email: string; nickname?: string | null; createdAt?: number | null };
  resumes: Array<Record<string, unknown>>;
  versions: Array<Record<string, unknown>>;
  shareLinks: Array<Record<string, unknown>>;
  applications: Array<Record<string, unknown>>;
  nowSeconds?: number;
}) {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  return {
    format: 'openresume-account-export',
    version: 1,
    exportedAt: now,
    account: {
      id: input.user.id,
      email: input.user.email,
      nickname: input.user.nickname ?? null,
      createdAt: input.user.createdAt ?? null
    },
    counts: {
      resumes: input.resumes.length,
      versions: input.versions.length,
      shareLinks: input.shareLinks.length,
      applications: input.applications.length
    },
    resumes: input.resumes,
    versions: input.versions,
    shareLinks: input.shareLinks,
    applications: input.applications
  };
}
