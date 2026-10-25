/**
 * 投递记录的行映射与统计。
 *
 * 抽成纯函数：统计口径（面试率、Offer 率的分母是什么）最容易在前后端各算一遍
 * 然后对不上，放在一处并让单测锁死。
 */

import type { ApplicationStats, ApplicationStatus, JobApplication } from '../../shared/types';
import { APPLICATION_STATUSES } from '../../shared/types';

/** 视为「已经投出去」的状态；`saved`（想投）不计入分母 */
const APPLIED_STATUSES: ApplicationStatus[] = ['applied', 'interviewing', 'offer', 'rejected'];

const isStatus = (value: unknown): value is ApplicationStatus =>
  typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);

/** 数据库行 → API 返回结构（snake_case → camelCase，空串归一为 null） */
export function mapApplicationRow(row: any): JobApplication {
  const text = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };
  const time = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return {
    id: String(row.id),
    resumeId: text(row.resume_id),
    resumeTitle: text(row.resume_title),
    company: String(row.company ?? ''),
    position: String(row.position ?? ''),
    location: text(row.location),
    channel: text(row.channel),
    status: isStatus(row.status) ? row.status : 'applied',
    appliedAt: time(row.applied_at),
    nextActionAt: time(row.next_action_at),
    nextActionNote: text(row.next_action_note),
    salaryRange: text(row.salary_range),
    jobUrl: text(row.job_url),
    notes: text(row.notes),
    createdAt: time(row.created_at) ?? 0,
    updatedAt: time(row.updated_at) ?? 0
  };
}

/** 跟进提醒窗口：7 天内到期的算「近期要处理」 */
export const DUE_SOON_SECONDS = 7 * 24 * 3600;

/**
 * 统计。
 *
 * 面试率与 Offer 率的分母统一是「已投递」，不是「全部记录」——
 * 把「想投」也算进分母会让转化率看起来低得没有参考价值。
 * 分母为 0 时返回 0，而不是 NaN（NaN 会一路传到界面上显示成 "NaN%"）。
 */
export function computeApplicationStats(
  rows: Array<Pick<JobApplication, 'status' | 'nextActionAt'>>,
  nowSeconds: number
): ApplicationStats {
  let applied = 0;
  let interviewing = 0;
  let offer = 0;
  let rejected = 0;
  let dueSoon = 0;

  for (const row of rows) {
    if (APPLIED_STATUSES.includes(row.status)) applied += 1;
    if (row.status === 'interviewing') interviewing += 1;
    if (row.status === 'offer') offer += 1;
    if (row.status === 'rejected') rejected += 1;

    const due = row.nextActionAt;
    // 已完成的记录不该再提醒；过期的提醒仍然算「待处理」，否则会被无声吞掉
    if (
      typeof due === 'number' &&
      due > 0 &&
      row.status !== 'offer' &&
      row.status !== 'rejected' &&
      due <= nowSeconds + DUE_SOON_SECONDS
    ) {
      dueSoon += 1;
    }
  }

  const rate = (numerator: number) => (applied > 0 ? Math.round((numerator / applied) * 100) : 0);

  return {
    total: rows.length,
    applied,
    interviewing,
    offer,
    rejected,
    interviewRate: rate(interviewing + offer),
    offerRate: rate(offer),
    dueSoon
  };
}
