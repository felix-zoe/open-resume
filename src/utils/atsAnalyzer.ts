import { ResumeContent } from '../types/resume';

export interface AtsAnalysisResult {
  score: number; // 0 ~ 100
  matchedKeywords: string[];
  missingKeywords: string[];
  metricsDensity: {
    totalPoints: number;
    pointsWithMetrics: number;
    ratio: number; // 0 ~ 1
  };
  actionVerbAnalysis: {
    weakCount: number;
    strongCount: number;
    suggestions: string[];
  };
  suggestions: string[];
}

// 常见强动词与弱动词映射
const WEAK_VERBS = ['负责', '参与', '协助', '配合', '日常维护', '简单处理', '了解'];
const STRONG_VERBS = ['主导', '统筹', '搭建', '重构', '突破', '推动', '落地', '优化', '提效', '攻关', '设计并实现', '驱动'];

// 常见技能与职场高频核心词库字典（辅助分词提取）
const PRESET_KEYWORDS = [
  'Vue', 'Vue3', 'React', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Node.js', 'Webpack', 'Vite',
  'Tailwind', 'Pinia', 'Redux', '微前端', '性能优化', 'SSR', 'Canvas', 'WebGL', 'Docker', 'Kubernetes',
  'Java', 'Spring', 'Go', 'Golang', 'Python', 'Redis', 'MySQL', 'PostgreSQL', 'MongoDB', 'Kafka', 'MQ',
  'Linux', 'Git', 'CI/CD', 'RESTful', 'GraphQL', '算法', '高并发', '分布式', '微服务', 'DevOps',
  '项目管理', '敏捷开发', '跨部门协同', '需求分析', '系统架构', '技术选型', '单元测试', '代码审查',
  '用户体验', '数据分析', '产品增长', '业务落地', '性能调优', '工程化', '标准化'
];

/**
 * 从文本中提取关键技能词
 */
export function extractKeywords(text: string): string[] {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();

  // 1. 字典匹配
  for (const kw of PRESET_KEYWORDS) {
    if (lowerText.includes(kw.toLowerCase())) {
      found.add(kw);
    }
  }

  // 2. 匹配英文字母技术词（如 Electron, NestJS, Next.js, Rust 等）
  const englishTerms = text.match(/[A-Za-z][A-Za-z0-9+#.-]{1,20}/g) || [];
  for (const term of englishTerms) {
    if (term.length > 2 && !['and', 'the', 'for', 'with', 'from', 'have', 'this', 'that', 'work'].includes(term.toLowerCase())) {
      found.add(term);
    }
  }

  return Array.from(found);
}

/**
 * 汇总当前简历的所有文本内容
 */
export function aggregateResumeText(content: ResumeContent): string {
  const parts: string[] = [
    content.profile.title || '',
    content.profile.summary || '',
  ];

  // 工作经历
  for (const w of content.modules.work?.items || []) {
    parts.push(w.company, w.position, w.description);
  }

  // 项目经历
  for (const p of content.modules.projects?.items || []) {
    parts.push(p.name, p.role, p.description);
  }

  // 技能
  for (const s of content.modules.skills?.items || []) {
    parts.push(s);
  }

  // 自定义模块
  for (const c of content.modules.custom?.items || []) {
    parts.push(c);
  }

  return parts.join(' ');
}

/**
 * 核心分析算法
 */
export function analyzeResumeAgainstJd(resumeContent: ResumeContent, jdText: string): AtsAnalysisResult {
  const resumeFullText = aggregateResumeText(resumeContent);
  const resumeLower = resumeFullText.toLowerCase();

  // 1. 提取 JD 中的关键词
  const jdKeywords = extractKeywords(jdText);
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of jdKeywords) {
    if (resumeLower.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  // 2. 量化指标检测 (检测是否包含数字 + 单位，如: 30%, 200万, 3倍, 10+等)
  // 注意：此处不带 g 标志，避免在循环中反复调用 .test() 时 lastIndex 状态推进导致隔行判定失效
  const metricRegex = /\d+[%％倍万千人次个项起元条kK+＋]/;
  const workItems = resumeContent.modules.work?.items || [];
  const projectItems = resumeContent.modules.projects?.items || [];

  let totalPoints = 0;
  let pointsWithMetrics = 0;

  for (const item of [...workItems, ...projectItems]) {
    const lines = (item.description || '').split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      totalPoints++;
      if (metricRegex.test(line)) {
        pointsWithMetrics++;
      }
    }
  }

  const metricsRatio = totalPoints > 0 ? pointsWithMetrics / totalPoints : 0;

  // 3. 强动词与弱动词扫描
  let weakCount = 0;
  let strongCount = 0;

  for (const weak of WEAK_VERBS) {
    const matches = resumeFullText.match(new RegExp(weak, 'g'));
    if (matches) weakCount += matches.length;
  }

  for (const strong of STRONG_VERBS) {
    const matches = resumeFullText.match(new RegExp(strong, 'g'));
    if (matches) strongCount += matches.length;
  }

  // 4. 综合评分计算 (0 ~ 100)
  // 关键词覆盖率 50分
  const kwScore = jdKeywords.length > 0
    ? Math.round((matchedKeywords.length / jdKeywords.length) * 50)
    : 40;

  // 量化指标得分 30分
  const metricScore = Math.min(30, Math.round(metricsRatio * 40));

  // 动词强度得分 20分
  const verbTotal = weakCount + strongCount;
  const verbScore = verbTotal > 0
    ? Math.round((strongCount / verbTotal) * 20)
    : 10;

  const totalScore = Math.min(100, Math.max(20, kwScore + metricScore + verbScore));

  // 5. 建议生成
  const suggestions: string[] = [];
  if (missingKeywords.length > 0) {
    suggestions.push(`目标岗位重点关注的技能 [${missingKeywords.slice(0, 4).join(', ')}] 在简历中未被提及，建议补充到技能或项目描述中。`);
  }
  if (metricsRatio < 0.4) {
    suggestions.push(`量化指标占比偏低（目前仅 ${Math.round(metricsRatio * 100)}% 条目带具体数据）。建议使用“数字+百分比”阐述业绩成果。`);
  }
  if (weakCount > strongCount) {
    suggestions.push(`检测到 ${weakCount} 处“负责/协助”等偏平淡描述，建议替换为“主导”、“重构”、“攻关”等高影响力动词。`);
  }
  if (suggestions.length === 0) {
    suggestions.push('太棒了！你的简历关键词命中率极高，且量化指标充实，极具竞争力！');
  }

  return {
    score: totalScore,
    matchedKeywords,
    missingKeywords,
    metricsDensity: {
      totalPoints,
      pointsWithMetrics,
      ratio: metricsRatio
    },
    actionVerbAnalysis: {
      weakCount,
      strongCount,
      suggestions: weakCount > 0 ? ['建议将“负责”改为“主导/搭建”', '建议将“协助”改为“协同攻关”'] : []
    },
    suggestions
  };
}
