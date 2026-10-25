import { nextTick } from 'vue';
import { A4_HEIGHT_PX, MM_TO_PX, RESUME_DOC_SELECTOR, getPageCount, getUsableHeight } from '../utils/a4';
import type { ThemeConfig } from '../types/resume';

/**
 * 可调整的排版参数，按压缩/放大的优先级排列。
 *
 * 压缩时最后才动字号（可读性优先）；放大时最后才动页边距——页边距变小会
 * 让一页装下更多内容，反而显得更空，只有在字号/行高/间距都到上限后才用它
 * 收尾。两个方向的顺序并不对称，这是有意为之。
 */
const COMPRESS_ORDER = ['paragraphSpacing', 'sectionSpacing', 'lineHeight', 'fontSize', 'pagePadding'] as const;
const EXPAND_ORDER = ['fontSize', 'lineHeight', 'sectionSpacing', 'paragraphSpacing'] as const;

type ParamKey = (typeof COMPRESS_ORDER)[number] | (typeof EXPAND_ORDER)[number];

/** 每个参数的步长下限与安全边界 */
const LIMITS: Record<ParamKey, { step: number; min: number; max: number; precision?: number }> = {
  paragraphSpacing: { step: 1, min: 2, max: 12 },
  sectionSpacing: { step: 2, min: 8, max: 28 },
  lineHeight: { step: 0.03, min: 1.3, max: 1.8, precision: 2 },
  fontSize: { step: 0.4, min: 11, max: 16, precision: 1 },
  pagePadding: { step: 1, min: 10, max: 26 },
};

export interface AutoFitResult {
  success: boolean;
  message: string;
  /** 迭代轮数，便于排查收敛问题 */
  rounds: number;
  /** 应用前的主题快照，用于“撤销本次自动排版” */
  snapshot: ThemeConfig | null;
}

export interface AutoFitOptions {
  /** 目标页数，默认 1 */
  targetPages?: number;
  /** 最多迭代轮数 */
  maxRounds?: number;
  /** 最后一页的期望最低填充率，低于此值会尝试放大 */
  minFill?: number;
  /** 读取当前内容高度（默认从 DOM 测量） */
  measure?: () => number;
}

/** 测量预览区里的简历内容高度 */
export function measureContentHeight(): number {
  const doc = document.querySelector(`.a4-print-target ${RESUME_DOC_SELECTOR}`) as HTMLElement | null;
  return doc?.scrollHeight ?? 0;
}

function clampParam(key: ParamKey, value: number): number {
  const limit = LIMITS[key];
  const bounded = Math.min(limit.max, Math.max(limit.min, value));
  return limit.precision === undefined ? bounded : Number(bounded.toFixed(limit.precision));
}

/**
 * 迭代式自动排版（RENDER-07）。
 *
 * 旧实现一次性按溢出比例改一组参数就不管了：改完不重新测量，内容可能仍然
 * 超页，也可能被压得过狠。这里改成“调一步 → 等渲染 → 重新测量 → 判断”，
 * 达到目标页数即停。
 *
 * 步进按“剩余可调空间的百分比”走，而不是固定微步长——否则 1300px 的内容
 * 要十几轮才收敛，12 轮上限根本不够。参数之间是串行优先级：前一个参数压到
 * 边界后才动下一个，保证「先收间距、最后才动字号」，不破坏可读性。
 *
 * 只改主题参数，不动用户内容。
 */
export async function runAutoFit(
  theme: ThemeConfig,
  apply: (patch: Partial<ThemeConfig>) => void,
  options: AutoFitOptions = {}
): Promise<AutoFitResult> {
  const targetPages = Math.max(1, options.targetPages ?? 1);
  const maxRounds = options.maxRounds ?? 12;
  const minFill = options.minFill ?? 0.72;
  const measure = options.measure ?? measureContentHeight;

  const snapshot: ThemeConfig = JSON.parse(JSON.stringify(theme));

  const usableOf = (t: ThemeConfig) => getUsableHeight(t.pagePadding) * targetPages;
  const pagesOf = (height: number, t: ThemeConfig) => getPageCount(height, getUsableHeight(t.pagePadding));

  let height = measure();
  if (!Number.isFinite(height) || height <= 0) {
    return { success: false, message: '暂时无法测量排版高度，请稍后重试', rounds: 0, snapshot: null };
  }

  // 已达标：页数正确且填充率不至于太空，直接返回，不动任何参数
  if (pagesOf(height, theme) === targetPages && height / usableOf(theme) >= minFill) {
    return { success: true, message: '当前排版已符合目标页数，无需调整', rounds: 0, snapshot: null };
  }

  let rounds = 0;
  let lastDirection: 1 | -1 = pagesOf(height, theme) > targetPages ? -1 : 1;

  while (rounds < maxRounds) {
    const pages = pagesOf(height, theme);
    const fill = height / usableOf(theme);

    // 页数达标即视为成功。填充率只用来决定“要不要继续放大”，
    // 不参与成功判定——否则内容刚好填满一页时会被误判为失败。
    if (pages === targetPages && fill >= minFill) {
      return { success: true, message: '已自动排版至目标页数', rounds, snapshot };
    }

    // 页数超出 → 压缩；页数不足或页数正确但偏空 → 放大。
    // 注意 `pages` 最小为 1，`pages < targetPages` 只在 targetPages ≥ 2 时成立，
    // 因此“页数正确但填充不足”必须单独判成放大，否则会被误压。
    const direction: 1 | -1 = pages > targetPages ? -1 : 1;
    lastDirection = direction;

    const order = direction === -1 ? COMPRESS_ORDER : EXPAND_ORDER;
    const patch: Partial<ThemeConfig> = {};
    let adjusted = false;

    for (const key of order) {
      const current = Number(theme[key]);
      if (!Number.isFinite(current)) continue;

      const limit = LIMITS[key];
      const remaining = direction === -1 ? current - limit.min : limit.max - current;
      // 已到边界（留 1e-6 容差）则换下一个参数
      if (remaining <= 1e-6) continue;

      // 偏离目标越多，单轮走得越远；上限 60%，避免一步压过头
      const deficit = Math.abs(height / usableOf(theme) - 1);
      const factor = Math.min(0.6, 0.25 + deficit);
      const move = Math.max(limit.step, remaining * factor);
      const next = clampParam(key, current + direction * move);

      if (next === current) continue;
      patch[key] = next;
      adjusted = true;
      break;
    }

    if (!adjusted) break;

    apply(patch);
    Object.assign(theme, patch);
    rounds += 1;

    // 等 Vue 把新样式渲染到 DOM 后再测量，否则测到的还是上一轮的高度
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    height = measure();
    if (!Number.isFinite(height) || height <= 0) break;
  }

  const finalPages = pagesOf(height, theme);
  if (finalPages === targetPages) {
    return { success: true, message: '已自动排版至目标页数', rounds, snapshot };
  }

  const usable = usableOf(theme);
  const overBy = Math.round(Math.abs(height - usable));
  return {
    success: false,
    message:
      lastDirection === -1
        ? `内容超出目标页数约 ${overBy}px，排版参数已调到边界，建议精简 1–2 条经历`
        : '内容偏少，排版参数已放大到边界，仍不足以填满页面',
    rounds,
    snapshot,
  };
}

/** 供 UI 展示的 A4 常量（避免各页面各自 import） */
export const A4_METRICS = { height: A4_HEIGHT_PX, mmToPx: MM_TO_PX };
