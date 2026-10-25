import { describe, expect, it } from 'vitest';
import { computeApplicationStats, mapApplicationRow, DUE_SOON_SECONDS } from '../../functions/lib/applications';

const NOW = 1_700_000_000;

describe('mapApplicationRow', () => {
  it('snake_case 转 camelCase，空串归一为 null', () => {
    const row = mapApplicationRow({
      id: 'job_1',
      resume_id: 'res_1',
      resume_title: '前端简历',
      company: '某公司',
      position: '前端工程师',
      location: '  ',
      channel: '内推',
      status: 'interviewing',
      applied_at: NOW,
      next_action_at: NOW + 3600,
      next_action_note: '',
      salary_range: '30-40K',
      job_url: '',
      notes: '一面已过',
      created_at: NOW,
      updated_at: NOW
    });

    expect(row.resumeId).toBe('res_1');
    expect(row.resumeTitle).toBe('前端简历');
    expect(row.location).toBeNull();
    expect(row.nextActionNote).toBeNull();
    expect(row.jobUrl).toBeNull();
    expect(row.notes).toBe('一面已过');
    expect(row.appliedAt).toBe(NOW);
  });

  it('未知状态降级为 applied，而不是让整条记录消失', () => {
    const row = mapApplicationRow({ id: 'job_1', company: 'A', position: 'B', status: 'weird' });
    expect(row.status).toBe('applied');
  });

  it('时间为 0 / 负数 / 非数字时返回 null', () => {
    const row = mapApplicationRow({
      id: 'job_1',
      company: 'A',
      position: 'B',
      status: 'saved',
      applied_at: 0,
      next_action_at: -1,
      created_at: 'oops'
    });
    expect(row.appliedAt).toBeNull();
    expect(row.nextActionAt).toBeNull();
    expect(row.createdAt).toBe(0);
  });
});

describe('computeApplicationStats', () => {
  it('空列表时所有比例都是 0 而不是 NaN', () => {
    const stats = computeApplicationStats([], NOW);
    expect(stats).toEqual({
      total: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      interviewRate: 0,
      offerRate: 0,
      dueSoon: 0
    });
    expect(Number.isNaN(stats.interviewRate)).toBe(false);
  });

  it('「想投」不计入已投递分母', () => {
    const stats = computeApplicationStats(
      [
        { status: 'saved', nextActionAt: null },
        { status: 'applied', nextActionAt: null }
      ],
      NOW
    );
    expect(stats.total).toBe(2);
    expect(stats.applied).toBe(1);
    expect(stats.interviewRate).toBe(0);
  });

  it('面试率把 offer 也算进去（拿到 offer 必然面试过）', () => {
    const stats = computeApplicationStats(
      [
        { status: 'applied', nextActionAt: null },
        { status: 'interviewing', nextActionAt: null },
        { status: 'offer', nextActionAt: null },
        { status: 'rejected', nextActionAt: null }
      ],
      NOW
    );
    expect(stats.applied).toBe(4);
    expect(stats.interviewRate).toBe(50); // (1 + 1) / 4
    expect(stats.offerRate).toBe(25);
  });

  it('比例取整到整数百分比', () => {
    const stats = computeApplicationStats(
      [
        { status: 'interviewing', nextActionAt: null },
        { status: 'applied', nextActionAt: null },
        { status: 'applied', nextActionAt: null }
      ],
      NOW
    );
    expect(stats.interviewRate).toBe(33);
  });

  it('7 天内到期的跟进计入 dueSoon', () => {
    const stats = computeApplicationStats(
      [
        { status: 'applied', nextActionAt: NOW + DUE_SOON_SECONDS - 1 },
        { status: 'applied', nextActionAt: NOW + DUE_SOON_SECONDS + 1 },
        { status: 'applied', nextActionAt: null }
      ],
      NOW
    );
    expect(stats.dueSoon).toBe(1);
  });

  it('已过期未处理的提醒仍然计入（否则会被无声吞掉）', () => {
    const stats = computeApplicationStats(
      [{ status: 'applied', nextActionAt: NOW - 86400 }],
      NOW
    );
    expect(stats.dueSoon).toBe(1);
  });

  it('已录用 / 已淘汰不再提醒', () => {
    const stats = computeApplicationStats(
      [
        { status: 'offer', nextActionAt: NOW },
        { status: 'rejected', nextActionAt: NOW }
      ],
      NOW
    );
    expect(stats.dueSoon).toBe(0);
  });
});
