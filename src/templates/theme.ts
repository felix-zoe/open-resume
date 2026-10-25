import type { CSSProperties } from 'vue';
import type { ResumeProfile, ThemeConfig } from '../types/resume';

/**
 * 把主题配置翻译成简历文档根节点上的 CSS 变量。
 *
 * 模板内所有尺寸都写成 `em`，因此这里只注入基准字号，其余全部自动等比例
 * 缩放——这正是“字号滑块”能生效的前提。不要把 font-size 写在子元素上。
 *
 * 注意：这里**不设置 padding**。页边距由每一张 A4 纸张（`.a4-page`）提供，
 * 这样多页时分页后的每一页都有完整留白，而不是只有第一页有（RENDER-04）。
 */
export function buildDocStyle(theme: ThemeConfig): CSSProperties {
  return {
    '--rs-font-size': `${theme.fontSize}px`,
    '--rs-line-height': String(theme.lineHeight),
    '--rs-color': theme.themeColor,
    '--rs-section-gap': `${theme.sectionSpacing}px`,
    '--rs-para-gap': `${theme.paragraphSpacing}px`,
    '--rs-page-pad': `${theme.pagePadding}mm`,
  } as CSSProperties;
}

/**
 * 薪资是否渲染。
 *
 * 国内简历里薪资期望常被 HR 视为减分项，且多数模板把它放在头部很突兀，
 * 因此默认隐藏；`theme.showSalary === true` 时才显示（数据本身保留）。
 */
export function showSalaryOf(theme: ThemeConfig, profile: ResumeProfile): boolean {
  return theme.showSalary === true && Boolean(profile.salaryExpectation);
}
