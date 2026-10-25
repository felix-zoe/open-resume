import { describe, expect, it } from 'vitest';
import {
  analyzeKeywordCoverage,
  analyzeResumeAgainstJd,
  canonicalTerm,
  extractKeywords,
  splitJdSections
} from '../../src/utils/atsAnalyzer';
import type { ResumeContent } from '../../src/types/resume';

function makeContent(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    profile: {
      name: '张三',
      title: '前端工程师',
      email: 'a@b.com',
      phone: '13800138000',
      showAvatar: false,
      summary: '5 年前端经验，主导 Vue3 微前端改造'
    },
    modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
    modules: {
      work: {
        visible: true,
        title: '工作经历',
        items: [
          {
            id: 'w1',
            company: '某公司',
            position: '前端工程师',
            startDate: '2021.01',
            endDate: '至今',
            description: '主导性能优化，首屏耗时降低 40%\n负责 TypeScript 基建'
          }
        ]
      },
      projects: { visible: true, title: '项目经历', items: [] },
      skills: { visible: true, title: '专业技能', items: ['Vue3', 'TypeScript', 'Vite'] },
      education: { visible: true, title: '教育背景', items: [] },
      custom: { visible: false, title: '自定义模块', items: [] }
    },
    ...overrides
  };
}

describe('canonicalTerm', () => {
  it('同义词归一到规范词', () => {
    expect(canonicalTerm('Vue.js')).toBe('vue');
    expect(canonicalTerm('Vue3')).toBe('vue');
    expect(canonicalTerm('K8s')).toBe('kubernetes');
    expect(canonicalTerm('TS')).toBe('typescript');
  });

  it('不在同义词表里的原样小写返回', () => {
    expect(canonicalTerm('Rust')).toBe('rust');
  });
});

describe('splitJdSections', () => {
  it('按「任职要求」切开，职责与要求分开', () => {
    const jd = '岗位职责：负责前端开发。\n任职要求：熟悉 Vue3。';
    const { responsibilities, requirements } = splitJdSections(jd);
    expect(responsibilities).toContain('岗位职责');
    expect(responsibilities).not.toContain('任职要求');
    expect(requirements).toContain('任职要求');
  });

  it('没有标记时全部视为职责描述', () => {
    const jd = '负责前端开发，熟悉 Vue3';
    expect(splitJdSections(jd).requirements).toBe('');
  });

  it('支持英文标记', () => {
    const jd = 'Build things.\nRequirements: Vue3, TypeScript';
    expect(splitJdSections(jd).requirements).toContain('Vue3');
  });
});

describe('extractKeywords', () => {
  it('提取字典词与英文技术词', () => {
    const keywords = extractKeywords('熟悉 Vue3、TypeScript 与 NestJS');
    expect(keywords).toContain('vue');
    expect(keywords).toContain('typescript');
    expect(keywords).toContain('nestjs');
  });

  it('过滤停用词', () => {
    const keywords = extractKeywords('you will work with the team');
    expect(keywords).not.toContain('you');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('work');
  });
});

describe('analyzeKeywordCoverage', () => {
  it('简历里有的词进 matched，没有的进 missing', () => {
    const coverage = analyzeKeywordCoverage(makeContent(), '任职要求：熟悉 Vue3、TypeScript、Kubernetes');
    expect(coverage.matched).toContain('vue');
    expect(coverage.matched).toContain('typescript');
    expect(coverage.missing).toContain('kubernetes');
  });

  it('同义词命中：JD 写 Vue.js、简历写 Vue3 视为已覆盖', () => {
    const coverage = analyzeKeywordCoverage(makeContent(), '任职要求：精通 Vue.js');
    expect(coverage.matched).toContain('vue');
    expect(coverage.missing).not.toContain('vue');
  });

  it('任职要求的权重高于岗位职责', () => {
    // 职责里提到 Kubernetes（权重 0.5），要求里提到 Rust（权重 1）
    const jd = '岗位职责：了解 Kubernetes\n任职要求：熟悉 Rust';
    const coverage = analyzeKeywordCoverage(makeContent(), jd);
    // 两个都没命中，总权重应为 1.5
    expect(coverage.totalWeight).toBeCloseTo(1.5, 5);
  });

  it('同一关键词同时出现在两段时不重复计数', () => {
    const jd = '岗位职责：Vue3\n任职要求：Vue3';
    const coverage = analyzeKeywordCoverage(makeContent(), jd);
    // 只算一次，且取较高权重 1
    expect(coverage.totalWeight).toBeCloseTo(1, 5);
  });

  it('missing 按权重降序，硬性要求排在职责描述前', () => {
    const jd = '岗位职责：了解 Redis\n任职要求：熟悉 Kafka';
    const coverage = analyzeKeywordCoverage(makeContent(), jd);
    expect(coverage.missing[0]).toBe('kafka');
  });

  it('空 JD 时 ratio 为 0 而不是 NaN', () => {
    const coverage = analyzeKeywordCoverage(makeContent(), '');
    expect(coverage.ratio).toBe(0);
    expect(Number.isNaN(coverage.ratio)).toBe(false);
  });
});

describe('analyzeResumeAgainstJd', () => {
  it('不再输出 0–100 总分', () => {
    const result = analyzeResumeAgainstJd(makeContent(), '任职要求：Vue3');
    expect(result).not.toHaveProperty('score');
    expect(result).not.toHaveProperty('matchedKeywords');
    expect(result).not.toHaveProperty('missingKeywords');
  });

  it('量化指标按行统计', () => {
    const result = analyzeResumeAgainstJd(makeContent(), '任职要求：Vue3');
    expect(result.metricsDensity.totalPoints).toBe(2);
    expect(result.metricsDensity.pointsWithMetrics).toBe(1);
    expect(result.metricsDensity.ratio).toBeCloseTo(0.5, 5);
  });

  it('没有经历条目时给出明确提示而不是 0% 占比', () => {
    const empty = makeContent({
      modules: {
        ...makeContent().modules,
        work: { visible: true, title: '工作经历', items: [] }
      }
    });
    const result = analyzeResumeAgainstJd(empty, '任职要求：Vue3');
    expect(result.suggestions.join('')).toContain('还没有可统计的经历条目');
  });

  it('弱动词多于强动词时给出替换建议', () => {
    const content = makeContent();
    content.modules.work.items[0].description = '负责日常维护\n负责简单处理\n协助排查';
    const result = analyzeResumeAgainstJd(content, '任职要求：Vue3');
    expect(result.actionVerbAnalysis.weakCount).toBeGreaterThan(result.actionVerbAnalysis.strongCount);
    expect(result.suggestions.join('')).toContain('负责');
  });

  it('关键词全覆盖时不再提示补充', () => {
    const result = analyzeResumeAgainstJd(makeContent(), '任职要求：Vue3、TypeScript');
    expect(result.suggestions.join('')).not.toContain('未被提及');
  });
});
