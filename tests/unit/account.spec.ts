import { describe, expect, it } from 'vitest';
import {
  DELETION_GRACE_SECONDS,
  RETENTION,
  buildAccountExport,
  deletionDaysLeft,
  exportFileName,
  isDeletionDue,
  isInGracePeriod,
  visitRetentionCutoff
} from '../../functions/lib/account';

const NOW = 1_760_000_000;

describe('注销冷静期', () => {
  it('未申请注销时没有倒计时', () => {
    expect(deletionDaysLeft(null, NOW)).toBeNull();
    expect(deletionDaysLeft(undefined, NOW)).toBeNull();
    expect(deletionDaysLeft(0, NOW)).toBeNull();
  });

  it('刚提交时剩余 7 天', () => {
    expect(deletionDaysLeft(NOW, NOW)).toBe(7);
  });

  it('剩余天数向上取整：差 1 秒也算「还有 1 天」', () => {
    expect(deletionDaysLeft(NOW - DELETION_GRACE_SECONDS + 1, NOW)).toBe(1);
  });

  it('到期后剩余 0 天且判定为可删除', () => {
    const requestedAt = NOW - DELETION_GRACE_SECONDS;
    expect(deletionDaysLeft(requestedAt, NOW)).toBe(0);
    expect(isDeletionDue(requestedAt, NOW)).toBe(true);
    expect(isInGracePeriod(requestedAt, NOW)).toBe(false);
  });

  it('冷静期内 isDeletionDue 为 false、isInGracePeriod 为 true', () => {
    const requestedAt = NOW - 2 * 86400;
    expect(isDeletionDue(requestedAt, NOW)).toBe(false);
    expect(isInGracePeriod(requestedAt, NOW)).toBe(true);
    expect(deletionDaysLeft(requestedAt, NOW)).toBe(5);
  });

  it('未申请时既不到期也不在冷静期', () => {
    expect(isDeletionDue(null, NOW)).toBe(false);
    expect(isInGracePeriod(null, NOW)).toBe(false);
  });

  it('异常输入不崩：非有限数视为未申请', () => {
    expect(deletionDaysLeft(Number.NaN, NOW)).toBeNull();
    expect(isDeletionDue(Number.POSITIVE_INFINITY, NOW)).toBe(false);
  });
});

describe('数据保留', () => {
  it('访问记录保留 180 天', () => {
    expect(RETENTION.visitDays).toBe(180);
    expect(visitRetentionCutoff(NOW)).toBe(NOW - 180 * 86400);
  });

  it('版本保留 20 个，与 versions.ts 的上限一致', () => {
    expect(RETENTION.versionCount).toBe(20);
  });
});

describe('导出文件名', () => {
  it('邮箱里的特殊字符被替换成短横线', () => {
    expect(exportFileName('alice+job@example.com', NOW)).toBe('openresume-alice-job-example-com-2025-10-09.json');
  });

  it('首尾短横线被去掉', () => {
    expect(exportFileName('...alice...@x.com', NOW)).not.toMatch(/--/);
    expect(exportFileName('...alice...@x.com', NOW).startsWith('openresume-alice')).toBe(true);
  });

  it('空邮箱回落到 account，不产生空文件名', () => {
    expect(exportFileName('', NOW)).toBe('openresume-account-2025-10-09.json');
  });

  it('超长邮箱被截断到 60 字符以内', () => {
    const name = exportFileName(`${'a'.repeat(200)}@example.com`, NOW);
    expect(name.length).toBeLessThan(100);
  });
});

describe('账号导出', () => {
  const input = {
    user: { id: 'usr_1', email: 'a@example.com', nickname: '阿离', createdAt: NOW - 1000 },
    resumes: [{ id: 'res_1' }],
    versions: [{ id: 'ver_1' }, { id: 'ver_2' }],
    shareLinks: [],
    applications: [{ id: 'job_1' }],
    nowSeconds: NOW
  };

  it('带上格式标识与版本号，便于将来兼容', () => {
    const data = buildAccountExport(input);
    expect(data.format).toBe('openresume-account-export');
    expect(data.version).toBe(1);
  });

  it('counts 与实际数组长度一致', () => {
    const data = buildAccountExport(input);
    expect(data.counts).toEqual({ resumes: 1, versions: 2, shareLinks: 0, applications: 1 });
  });

  it('只导出账号自身信息，不含密码哈希', () => {
    const data = buildAccountExport({
      ...input,
      user: { ...input.user, password_hash: 'pbkdf2:...' } as any
    });
    expect(JSON.stringify(data)).not.toContain('pbkdf2');
    expect(Object.keys(data.account).sort()).toEqual(['createdAt', 'email', 'id', 'nickname']);
  });

  it('空账号也能导出（结构完整、计数为 0）', () => {
    const data = buildAccountExport({
      user: { id: 'usr_2', email: 'b@example.com' },
      resumes: [],
      versions: [],
      shareLinks: [],
      applications: [],
      nowSeconds: NOW
    });
    expect(data.counts.resumes).toBe(0);
    expect(data.account.nickname).toBeNull();
  });
});
