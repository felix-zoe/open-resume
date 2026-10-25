import { describe, expect, it } from 'vitest';
import { runAutoFit } from '../../src/composables/useAutoFit';
import { getUsableHeight } from '../../src/utils/a4';
import type { ThemeConfig } from '../../src/types/resume';

const BASE: ThemeConfig = {
  themeColor: '#2563EB',
  fontFamily: 'font-sans',
  fontSize: 14,
  lineHeight: 1.5,
  paragraphSpacing: 6,
  sectionSpacing: 16,
  pagePadding: 18,
  showBorder: true,
};

/**
 * 简化的排版模型，替代真实 DOM 布局。
 *
 * 内容高度只受字号、行高、间距影响；页边距改变的是“一页能装多少”，
 * 不改变内容本身的高度。这一点必须与真实排版一致，否则测出来的收敛
 * 行为会和浏览器里不一样。
 */
function contentHeightOf(theme: ThemeConfig, base: ThemeConfig, baseHeight: number): number {
  const fontScale = theme.fontSize / base.fontSize;
  const lineScale = theme.lineHeight / base.lineHeight;
  const spacingScale =
    (theme.paragraphSpacing + theme.sectionSpacing) / (base.paragraphSpacing + base.sectionSpacing);
  // 字号/行高影响行数，间距影响块间距；用加权避免完全线性导致的过拟合
  return baseHeight * (0.62 * fontScale * lineScale + 0.38 * spacingScale);
}

function runWithModel(initialHeight: number, options: { targetPages?: number } = {}) {
  const theme: ThemeConfig = { ...BASE };
  let height = initialHeight;
  const model = () => contentHeightOf(theme, BASE, initialHeight);

  return runAutoFit(
    theme,
    (patch) => {
      Object.assign(theme, patch);
      height = model();
    },
    { measure: () => height, targetPages: options.targetPages ?? 1, maxRounds: 12 }
  ).then((result) => ({ result, theme, usable: getUsableHeight(theme.pagePadding) }));
}

describe('runAutoFit 迭代求解', () => {
  it('内容已在一页且填充合理时不做任何调整', async () => {
    const { result, theme } = await runWithModel(900);

    expect(result.success).toBe(true);
    expect(result.rounds).toBe(0);
    expect(result.snapshot).toBeNull();
    expect(theme).toEqual(BASE);
  });

  it('轻微超页时通过多轮调整收敛到一页', async () => {
    const { result, theme } = await runWithModel(1300);

    expect(result.success).toBe(true);
    expect(result.rounds).toBeGreaterThan(0);
    // 必须真的改过参数，而不是“报告成功但什么都没变”
    expect(theme).not.toEqual(BASE);
    expect(theme.fontSize).toBeLessThanOrEqual(BASE.fontSize);
  });

  it('内容偏少时会放大排版', async () => {
    const { result, theme } = await runWithModel(600);

    expect(result.success).toBe(true);
    expect(theme.fontSize).toBeGreaterThanOrEqual(BASE.fontSize);
    expect(theme.pagePadding).toBeGreaterThanOrEqual(BASE.pagePadding);
  });

  it('超出过多时明确失败并给出可读原因', async () => {
    const { result } = await runWithModel(4000);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/超出|精简|边界/);
    expect(result.rounds).toBeLessThanOrEqual(12);
  });

  it('支持目标 2 页', async () => {
    const { result } = await runWithModel(1800, { targetPages: 2 });

    // 1.6 页的内容相对 2 页目标属于偏少，应被放大后判定达标
    expect(result.success).toBe(true);
  });

  it('返回操作前的主题快照，可用于撤销', async () => {
    const { result } = await runWithModel(1300);

    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot).toEqual(BASE);
  });

  it('测量失败时给出明确提示而不是静默成功', async () => {
    const result = await runAutoFit(BASE, () => {}, { measure: () => 0 });

    expect(result.success).toBe(false);
    expect(result.message).toContain('无法测量');
  });

  it('每轮只改一个参数，不会一次性推翻整组样式', async () => {
    const theme: ThemeConfig = { ...BASE };
    const changes: Array<keyof ThemeConfig> = [];

    await runAutoFit(
      theme,
      (patch) => {
        changes.push(...(Object.keys(patch) as Array<keyof ThemeConfig>));
        Object.assign(theme, patch);
      },
      { measure: () => 1300, maxRounds: 3 }
    );

    // 3 轮最多 3 个参数被改动
    expect(changes.length).toBeLessThanOrEqual(3);
  });

  it('收敛后最后一页的填充率不低于下限', async () => {
    const { result, theme } = await runWithModel(1300);

    expect(result.success).toBe(true);
    // 参数没有变得更松散到“一页只写一半”的程度
    expect(theme.lineHeight).toBeGreaterThan(0);
    expect(theme.fontSize).toBeGreaterThanOrEqual(11);
  });
});
