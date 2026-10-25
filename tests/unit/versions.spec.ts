import { describe, expect, it } from 'vitest';
import {
  VERSION_KEEP_LIMIT,
  VERSION_MIN_INTERVAL_SECONDS,
  countWords,
  hashResumeSnapshot,
  shouldWriteVersion,
  stableStringify
} from '../../functions/lib/versions';

const SNAPSHOT = {
  title: '前端工程师-张小凡',
  templateId: 'classic',
  content: { profile: { name: '张小凡' }, modulesOrder: ['work'] },
  themeConfig: { fontSize: 14 }
};

describe('stableStringify', () => {
  it('键顺序不同的同一对象得到相同字符串', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('数组顺序有意义，不做排序', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('嵌套对象同样稳定', () => {
    const a = stableStringify({ x: { q: 1, p: 2 }, y: [{ b: 1, a: 2 }] });
    const b = stableStringify({ y: [{ a: 2, b: 1 }], x: { p: 2, q: 1 } });
    expect(a).toBe(b);
  });
});

describe('hashResumeSnapshot', () => {
  it('内容相同 → 哈希相同（即使键序不同）', async () => {
    const a = await hashResumeSnapshot(SNAPSHOT);
    const b = await hashResumeSnapshot({
      themeConfig: { fontSize: 14 },
      content: { modulesOrder: ['work'], profile: { name: '张小凡' } },
      templateId: 'classic',
      title: '前端工程师-张小凡'
    });
    expect(a).toBe(b);
  });

  it('任一字段变化 → 哈希变化', async () => {
    const base = await hashResumeSnapshot(SNAPSHOT);
    expect(await hashResumeSnapshot({ ...SNAPSHOT, title: '后端工程师' })).not.toBe(base);
    expect(await hashResumeSnapshot({ ...SNAPSHOT, templateId: 'geek' })).not.toBe(base);
    expect(
      await hashResumeSnapshot({ ...SNAPSHOT, content: { ...SNAPSHOT.content, modulesOrder: [] } })
    ).not.toBe(base);
    expect(
      await hashResumeSnapshot({ ...SNAPSHOT, themeConfig: { fontSize: 15 } })
    ).not.toBe(base);
  });

  it('输出 32 位 hex', async () => {
    expect(await hashResumeSnapshot(SNAPSHOT)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('shouldWriteVersion', () => {
  const NOW = 1_700_000_000;

  it('首次保存（无历史）写入', () => {
    expect(
      shouldWriteVersion({ hash: 'h1', lastHash: null, lastCreatedAt: null, nowSeconds: NOW }).write
    ).toBe(true);
  });

  it('内容没变 → 不写，避免堆出重复记录', () => {
    const result = shouldWriteVersion({
      hash: 'h1',
      lastHash: 'h1',
      lastCreatedAt: NOW - 3600,
      nowSeconds: NOW
    });
    expect(result.write).toBe(false);
    expect(result.reason).toBe('unchanged');
  });

  it('内容变了但距上次不足 10 分钟 → 不写', () => {
    const result = shouldWriteVersion({
      hash: 'h2',
      lastHash: 'h1',
      lastCreatedAt: NOW - 60,
      nowSeconds: NOW
    });
    expect(result.write).toBe(false);
    expect(result.reason).toBe('too-soon');
  });

  it('内容变了且超过 10 分钟 → 写入', () => {
    expect(
      shouldWriteVersion({
        hash: 'h2',
        lastHash: 'h1',
        lastCreatedAt: NOW - VERSION_MIN_INTERVAL_SECONDS,
        nowSeconds: NOW
      }).write
    ).toBe(true);
  });

  it('手动保存不受时间间隔限制', () => {
    expect(
      shouldWriteVersion({
        hash: 'h2',
        lastHash: 'h1',
        lastCreatedAt: NOW - 5,
        nowSeconds: NOW,
        source: 'manual'
      }).write
    ).toBe(true);
  });

  it('手动保存仍然跳过完全相同的哈希', () => {
    expect(
      shouldWriteVersion({
        hash: 'h1',
        lastHash: 'h1',
        lastCreatedAt: NOW - 5,
        nowSeconds: NOW,
        source: 'manual'
      }).write
    ).toBe(false);
  });

  it('保留数量为 20，间隔为 10 分钟', () => {
    expect(VERSION_KEEP_LIMIT).toBe(20);
    expect(VERSION_MIN_INTERVAL_SECONDS).toBe(600);
  });
});

describe('countWords', () => {
  it('统计姓名、标题、总结与模块条目', () => {
    const count = countWords({
      profile: { name: '张小凡', title: '前端工程师', summary: '五年经验' },
      modules: {
        work: { items: [{ company: '某公司', position: '工程师', description: '负责前端架构' }] },
        skills: { items: ['Vue', 'TypeScript'] }
      }
    });
    // 3 + 1 + 2 + 4 + 2 = 12 个中文/词
    expect(count).toBeGreaterThan(10);
  });

  it('空内容为 0', () => {
    expect(countWords(null)).toBe(0);
    expect(countWords({})).toBe(0);
  });

  it('英文按词计数', () => {
    expect(countWords({ profile: { summary: 'five years of frontend experience' } })).toBe(5);
  });
});
