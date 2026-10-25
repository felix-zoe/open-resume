import { ResumeContent } from '../types/resume';

/**
 * 岗位 JD 关键词对照。
 *
 * 刻意**不输出 0–100 的单一总分**：这类分数没有可解释的口径，
 * 用户无法知道「78 分」差在哪、改什么能涨分，反而容易被当成通过率。
 * 这里改为三个可解释的维度，每个都给出分子/分母，用户能自己判断权重。
 */
export interface KeywordCoverage {
  /** 简历里已出现的关键词（去重后） */
  matched: string[];
  /** JD 里出现、简历里没有的关键词 */
  missing: string[];
  /** 已命中关键词在 JD 中的权重和 */
  matchedWeight: number;
  /** JD 关键词总权重 */
  totalWeight: number;
  /** matchedWeight / totalWeight，0–1 */
  ratio: number;
}

export interface AtsAnalysisResult {
  keywordCoverage: KeywordCoverage;
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

// 常见强动词与弱动词
const WEAK_VERBS = ['负责', '参与', '协助', '配合', '日常维护', '简单处理', '了解'];
const STRONG_VERBS = ['主导', '统筹', '搭建', '重构', '突破', '推动', '落地', '优化', '提效', '攻关', '设计并实现', '驱动'];

// 常见技能与职场高频核心词库（辅助分词提取）
const PRESET_KEYWORDS = [
  'Vue', 'Vue3', 'React', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Node.js', 'Webpack', 'Vite',
  'Tailwind', 'Pinia', 'Redux', '微前端', '性能优化', 'SSR', 'Canvas', 'WebGL', 'Docker', 'Kubernetes',
  'Java', 'Spring', 'Go', 'Golang', 'Python', 'Redis', 'MySQL', 'PostgreSQL', 'MongoDB', 'Kafka', 'MQ',
  'Linux', 'Git', 'CI/CD', 'RESTful', 'GraphQL', '算法', '高并发', '分布式', '微服务', 'DevOps',
  '项目管理', '敏捷开发', '跨部门协同', '需求分析', '系统架构', '技术选型', '单元测试', '代码审查',
  '用户体验', '数据分析', '产品增长', '业务落地', '性能调优', '工程化', '标准化'
];

/**
 * 同义词组：同组内任意写法视为同一个关键词。
 *
 * 不加这一层会出现「JD 写 Vue.js、简历写 Vue3，判为未覆盖」的假阴性，
 * 用户照着提示反复补充同一个技能也补不掉。
 */
const SYNONYM_GROUPS: string[][] = [
  ['vue', 'vue.js', 'vuejs', 'vue3', 'vue 3'],
  ['react', 'react.js', 'reactjs'],
  ['typescript', 'ts'],
  ['javascript', 'js'],
  ['node.js', 'nodejs', 'node'],
  ['kubernetes', 'k8s'],
  ['postgresql', 'postgres', 'pg'],
  ['ci/cd', 'cicd', '持续集成'],
  ['restful', 'rest', 'rest api'],
  ['graphql', 'gql'],
  ['微前端', 'micro frontend', 'micro-frontend'],
  ['性能优化', '性能调优', '性能提升'],
  ['单元测试', '单测', 'unit test'],
  ['跨部门协同', '跨部门协作', '跨团队协作'],
  ['数据分析', '数据驱动']
];

/** 别名 → 规范词（取组内第一个） */
const SYNONYM_LOOKUP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const alias of group) SYNONYM_LOOKUP.set(alias, canonical);
}

/** 取规范词；不在同义词表里的原样返回（小写） */
export function canonicalTerm(term: string): string {
  const lower = term.trim().toLowerCase();
  return SYNONYM_LOOKUP.get(lower) ?? lower;
}

/** 文本里是否出现了该关键词的任意一种写法 */
function textContainsTerm(lowerText: string, canonical: string): boolean {
  const aliases = SYNONYM_GROUPS.find((group) => group[0] === canonical) ?? [canonical];
  return aliases.some((alias) => lowerText.includes(alias));
}

const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'have', 'this', 'that', 'work', 'are', 'you', 'will',
  'our', 'your', 'team', 'years', 'year', 'plus', 'etc', 'able', 'must', 'good', 'best'
]);

/** 从文本中提取关键技能词（已按同义词归一） */
export function extractKeywords(text: string): string[] {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();

  for (const kw of PRESET_KEYWORDS) {
    if (lowerText.includes(kw.toLowerCase())) {
      found.add(canonicalTerm(kw));
    }
  }

  // 英文技术词（Electron, NestJS, Rust…）；同义词归一后再去重
  const englishTerms = text.match(/[A-Za-z][A-Za-z0-9+#./-]{1,20}/g) || [];
  for (const term of englishTerms) {
    if (term.length > 2 && !STOP_WORDS.has(term.toLowerCase())) {
      found.add(canonicalTerm(term));
    }
  }

  return Array.from(found);
}

/**
 * 把 JD 拆成「岗位职责」与「任职要求」两部分。
 *
 * 任职要求里写的是硬性门槛（必须会什么），职责描述里常夹带团队背景介绍，
 * 两者同等加权会让覆盖率虚高。这里给要求 1.0、职责 0.5 的权重。
 */
export function splitJdSections(jdText: string): { responsibilities: string; requirements: string } {
  const requirementMarkers = /(任职要求|岗位要求|职位要求|任职资格|加分项|优先条件|you will need|requirements|qualifications)/i;
  const match = requirementMarkers.exec(jdText);
  if (!match) return { responsibilities: jdText, requirements: '' };

  const cut = match.index;
  return {
    responsibilities: jdText.slice(0, cut),
    requirements: jdText.slice(cut)
  };
}

/** 汇总当前简历的所有文本内容 */
export function aggregateResumeText(content: ResumeContent): string {
  const parts: string[] = [content.profile.title || '', content.profile.summary || ''];

  for (const w of content.modules.work?.items || []) {
    parts.push(w.company, w.position, w.description);
  }
  for (const p of content.modules.projects?.items || []) {
    parts.push(p.name, p.role, p.description);
  }
  for (const s of content.modules.skills?.items || []) {
    parts.push(s);
  }
  for (const c of content.modules.custom?.items || []) {
    parts.push(c);
  }

  return parts.join(' ');
}

/** 关键词覆盖分析（含权重与同义词归一） */
export function analyzeKeywordCoverage(resumeContent: ResumeContent, jdText: string): KeywordCoverage {
  const resumeLower = aggregateResumeText(resumeContent).toLowerCase();
  const { responsibilities, requirements } = splitJdSections(jdText);

  // 同一关键词同时出现在两段时取较高权重，避免重复计数
  const weights = new Map<string, number>();
  const addAll = (text: string, weight: number) => {
    for (const kw of extractKeywords(text)) {
      weights.set(kw, Math.max(weights.get(kw) ?? 0, weight));
    }
  };
  addAll(responsibilities, 0.5);
  addAll(requirements, 1);

  const matched: string[] = [];
  const missing: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const [kw, weight] of weights) {
    totalWeight += weight;
    if (textContainsTerm(resumeLower, kw)) {
      matched.push(kw);
      matchedWeight += weight;
    } else {
      missing.push(kw);
    }
  }

  // 未命中关键词按权重降序：用户最该先补的是「硬性要求且没写」的那些
  missing.sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0));

  return {
    matched,
    missing,
    matchedWeight: Number(matchedWeight.toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(2)),
    ratio: totalWeight > 0 ? matchedWeight / totalWeight : 0
  };
}

/** 核心分析 */
export function analyzeResumeAgainstJd(
  resumeContent: ResumeContent,
  jdText: string
): AtsAnalysisResult {
  const resumeFullText = aggregateResumeText(resumeContent);

  // 1. 关键词覆盖
  const keywordCoverage = analyzeKeywordCoverage(resumeContent, jdText);

  // 2. 量化指标检测（数字 + 单位，如 30%、200 万、3 倍、10+）
  // 不带 g 标志：在循环里反复 .test() 时 lastIndex 会推进，导致隔行漏判
  const metricRegex = /\d+[%％倍万千人次个项起元条kK+＋]/;
  const workItems = resumeContent.modules.work?.items || [];
  const projectItems = resumeContent.modules.projects?.items || [];

  let totalPoints = 0;
  let pointsWithMetrics = 0;

  for (const item of [...workItems, ...projectItems]) {
    const lines = (item.description || '').split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
      totalPoints++;
      if (metricRegex.test(line)) pointsWithMetrics++;
    }
  }

  const metricsRatio = totalPoints > 0 ? pointsWithMetrics / totalPoints : 0;

  // 3. 动词扫描
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

  // 4. 建议（只描述「差在哪、怎么改」，不预测任何筛选结果）
  const suggestions: string[] = [];
  if (keywordCoverage.missing.length > 0) {
    suggestions.push(
      `目标岗位重点关注的技能 [${keywordCoverage.missing.slice(0, 4).join('、')}] 在简历中未被提及，建议补充到技能或项目描述中。`
    );
  }
  if (totalPoints === 0) {
    suggestions.push('还没有可统计的经历条目：先在「工作经历 / 项目经历」里补充带数据的成果描述。');
  } else if (metricsRatio < 0.4) {
    suggestions.push(
      `量化指标占比偏低（目前 ${Math.round(metricsRatio * 100)}% 条目带具体数据）。建议用「数字 + 百分比」说明业绩成果。`
    );
  }
  if (weakCount > strongCount) {
    suggestions.push(
      `检测到 ${weakCount} 处「负责 / 协助」等偏平淡的描述，建议替换为「主导」「重构」「攻关」等有结果指向的动词。`
    );
  }
  if (!suggestions.length) {
    suggestions.push('关键词覆盖与量化描述都比较充分，可以再检查一下每条经历是否都写清了结果。');
  }

  return {
    keywordCoverage,
    metricsDensity: {
      totalPoints,
      pointsWithMetrics,
      ratio: metricsRatio
    },
    actionVerbAnalysis: {
      weakCount,
      strongCount,
      suggestions:
        weakCount > 0
          ? ['建议将「负责」改为「主导 / 搭建」', '建议将「协助」改为「协同攻关」']
          : []
    },
    suggestions
  };
}
