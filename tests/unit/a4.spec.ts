import { describe, expect, it } from 'vitest';
import { A4_HEIGHT_PX, getBreakLines, getPageCount } from '../../src/utils/a4';

describe('A4 度量', () => {
  it('使用 96 DPI 下的 A4 物理高度', () => {
    // 297mm / 25.4 * 96
    expect(A4_HEIGHT_PX).toBeCloseTo(1122.52, 2);
  });
});

describe('getPageCount', () => {
  it('短内容恒为 1 页', () => {
    expect(getPageCount(0)).toBe(1);
    expect(getPageCount(500)).toBe(1);
    expect(getPageCount(A4_HEIGHT_PX)).toBe(1);
  });

  it('超出部分按页向上取整', () => {
    expect(getPageCount(A4_HEIGHT_PX + 1)).toBe(2);
    expect(getPageCount(1300)).toBe(2);
    expect(getPageCount(A4_HEIGHT_PX * 2)).toBe(2);
    expect(getPageCount(A4_HEIGHT_PX * 2 + 10)).toBe(3);
  });

  it('非法输入按 1 页处理', () => {
    expect(getPageCount(Number.NaN)).toBe(1);
    expect(getPageCount(-100)).toBe(1);
  });
});

describe('getBreakLines', () => {
  it('单页内容没有断线', () => {
    expect(getBreakLines(500)).toEqual([]);
    expect(getBreakLines(A4_HEIGHT_PX)).toEqual([]);
  });

  it('断线落在每页底部', () => {
    expect(getBreakLines(1300)).toEqual([1122.52]);
    expect(getBreakLines(A4_HEIGHT_PX * 2 + 100)).toEqual([1122.52, 2245.04]);
  });

  it('不会在内容结束后多画一条线', () => {
    const lines = getBreakLines(1300);
    expect(lines.every((y) => y < 1300)).toBe(true);
  });
});
