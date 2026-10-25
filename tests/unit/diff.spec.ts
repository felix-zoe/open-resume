import { describe, expect, it } from 'vitest';
import { diffLines, summarizeDiff, tokenize } from '../../src/utils/diff';

/**
 * 差异算法本身很简单，但它是「AI 改写必须过 diff」这条约束的地基：
 * 算错了不会报错，只会让用户看到一份不准确的对照，然后点下「采纳」。
 */

describe('tokenize', () => {
  it('中文逐字切分，英文与数字粘成一个单位', () => {
    expect(tokenize('Vue3')).toEqual(['Vue3']);
    expect(tokenize('用了 Vue3')).toEqual(['用', '了', ' ', 'Vue3']);
  });

  it('空格并入前一个单位，避免空白占掉半个 diff', () => {
    const tokens = tokenize('a b');
    expect(tokens).toEqual(['a ', 'b']);
  });

  it('标点单独成单位', () => {
    expect(tokenize('好。')).toEqual(['好', '。']);
  });
});

describe('diffLines', () => {
  it('完全相同时全部标记为 same', () => {
    const lines = diffLines('第一行\n第二行', '第一行\n第二行');
    expect(lines.map((line) => line.op)).toEqual(['same', 'same']);
    expect(lines[0].beforeLine).toBe(1);
    expect(lines[0].afterLine).toBe(1);
  });

  it('新增行标记为 add，且没有原文行号', () => {
    const lines = diffLines('第一行', '第一行\n第二行');
    expect(lines).toHaveLength(2);
    expect(lines[1].op).toBe('add');
    expect(lines[1].beforeLine).toBeNull();
    expect(lines[1].afterLine).toBe(2);
  });

  it('删除行标记为 remove，且没有改写后行号', () => {
    const lines = diffLines('第一行\n第二行', '第一行');
    expect(lines[1].op).toBe('remove');
    expect(lines[1].beforeLine).toBe(2);
    expect(lines[1].afterLine).toBeNull();
  });

  it('同位置的改写合并成一行，行内再分改了什么', () => {
    const lines = diffLines('负责官网开发', '主导官网重构');
    expect(lines).toHaveLength(1);
    const ops = lines[0].segments.map((segment) => segment.op);
    // 一段删、一段增：删的是「负责」，增的是「主导」「重构」
    expect(ops).toContain('remove');
    expect(ops).toContain('add');
    const removed = lines[0].segments.filter((s) => s.op === 'remove').map((s) => s.text).join('');
    expect(removed).toContain('负责');
  });

  it('多出来的删除行整行标红，不与新增行错配', () => {
    const lines = diffLines('A\nB\nC', 'A\nC1');
    // A 相同；B 被删；C 被改成 C1
    expect(lines[0].op).toBe('same');
    const removed = lines.filter((line) => line.op === 'remove');
    expect(removed.length).toBeGreaterThanOrEqual(2);
  });

  it('行号在改动前后各自递增，不会串位', () => {
    const lines = diffLines('一\n二\n三', '一\n三');
    expect(lines[0]).toMatchObject({ op: 'same', beforeLine: 1, afterLine: 1 });
    expect(lines[1]).toMatchObject({ op: 'remove', beforeLine: 2, afterLine: null });
    expect(lines[2]).toMatchObject({ op: 'same', beforeLine: 3, afterLine: 2 });
  });

  it('尾随换行不额外产生一行', () => {
    const lines = diffLines('只有一行\n', '只有一行');
    expect(lines).toHaveLength(1);
    expect(lines[0].op).toBe('same');
  });

  it('超长文本退化成整块替换而不是卡住', () => {
    const before = Array.from({ length: 500 }, (_, i) => `行 ${i}`).join('\n');
    const after = Array.from({ length: 500 }, (_, i) => `行 ${i + 1}`).join('\n');
    const lines = diffLines(before, after);
    expect(lines.length).toBe(1000);
    expect(lines.every((line) => line.segments.length === 1)).toBe(true);
  });
});

describe('summarizeDiff', () => {
  it('统计增删字数与净长度变化', () => {
    const stats = summarizeDiff('负责官网开发', '主导官网开发与重构');
    expect(stats.removed).toBeGreaterThan(0);
    expect(stats.added).toBeGreaterThan(0);
    expect(stats.lengthDelta).toBeGreaterThan(0);
  });

  it('完全相同的时间 delta 为 0', () => {
    const stats = summarizeDiff('一模一样', '一模一样');
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
    expect(stats.lengthDelta).toBe(0);
  });

  it('删掉内容时 delta 为负', () => {
    const stats = summarizeDiff('非常非常负责地完成了官网的开发工作', '主导官网开发');
    expect(stats.lengthDelta).toBeLessThan(0);
  });
});