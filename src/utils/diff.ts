/**
 * 文本差异（T5.7）。
 *
 * 存在的理由只有一个：AI 改写必须把「改了什么」摆在用户眼前让他点确认，
 * 而不是给一段新文字让他自己找不同。简历里的每一句都是事实陈述，
 * 看不出改动就等于默认接受模型可能塞进来的东西。
 *
 * 两级比较：
 * - 先按行做 LCS —— 简历描述本来就是「一行一条要点」，行的增删是最主要的改动；
 * - 对被改写的那几行再做一次词级 LCS，让「只换了两个动词」看得出来。
 *
 * 词级切分刻意把中文单字拆开、把连续的英文/数字粘在一起：中文没有空格，
 * 按「词」切需要分词器，按字切已经足够定位改动；英文技术名词拆开反而看不清。
 * 零依赖实现，不引入 diff 库 —— 这里只需要「看得懂」级别，不需要工业级。
 */

export type DiffOp = 'same' | 'add' | 'remove';

export interface DiffSegment {
  op: DiffOp;
  text: string;
}

export interface DiffLine {
  op: DiffOp;
  /**
   * 词级片段。整行新增/删除（没有配对行）时只有一个片段；
   * 配对成功时按词级差异拆开，供行内高亮。
   */
  segments: DiffSegment[];
  /** 该行左侧（原文）的行号，从 1 起；新增行为 null */
  beforeLine: number | null;
  /** 该行右侧（改写后）的行号，从 1 起；删除行为 null */
  afterLine: number | null;
}

/** 超过这个规模的比较直接放弃精细 diff，退化成「整行替换」 */
const MAX_LINES = 400;
const MAX_TOKENS_PER_SIDE = 600;

interface Patch<T> {
  op: DiffOp;
  value: T;
}

/**
 * 通用 LCS 差分。
 *
 * 用 (n+1)×(m+1) 的表格回溯，而不是 Hirschberg 之类的线性空间算法：
 * 这里的输入规模被上面的上限卡死在几百个元素，表格最多几万个 int，
 * 换来的是十行就能读懂。规模超限时由调用方退化处理。
 */
function lcsDiff<T>(before: T[], after: T[], equals: (a: T, b: T) => boolean): Patch<T>[] {
  const n = before.length;
  const m = after.length;
  const width = m + 1;
  const table = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] = equals(before[i], after[j])
        ? table[(i + 1) * width + (j + 1)] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const patches: Patch<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (equals(before[i], after[j])) {
      patches.push({ op: 'same', value: before[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      patches.push({ op: 'remove', value: before[i] });
      i += 1;
    } else {
      patches.push({ op: 'add', value: after[j] });
      j += 1;
    }
  }
  while (i < n) {
    patches.push({ op: 'remove', value: before[i] });
    i += 1;
  }
  while (j < m) {
    patches.push({ op: 'add', value: after[j] });
    j += 1;
  }
  return patches;
}

/**
 * 把一段文本切成比较单位。
 *
 * · 每个中日韩字符自成一个单位（中文一词一改，按字定位最准）；
 * · 连续的拉丁字母/数字/下划线算一个单位（`Vue3`、`K8s`、`redis` 不该被拆散）；
 * · 空白尽量粘在前一个单位上，避免空格本身占掉一半的 diff 结果。
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = '';
    }
  };

  for (const char of text) {
    // 制表符与空格并入前一个 token：`a b` 与 `a  b` 的差异不重要
    if (char === ' ' || char === '\t') {
      if (buffer) {
        buffer += char;
        flush();
      } else {
        tokens.push(char);
      }
      continue;
    }
    // 假名 / 中日韩汉字 / 兼容汉字 / 全角字符：逐字比较
    if (/[぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/.test(char)) {
      flush();
      tokens.push(char);
      continue;
    }
    if (/[A-Za-z0-9_]/.test(char)) {
      buffer += char;
      continue;
    }
    flush();
    tokens.push(char);
  }
  flush();
  return tokens;
}

/** 词级差异 → 片段列表（相邻同类片段合并，减少渲染节点数） */
function diffTokens(before: string, after: string): DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);

  if (a.length > MAX_TOKENS_PER_SIDE || b.length > MAX_TOKENS_PER_SIDE) {
    return [
      { op: 'remove', text: before },
      { op: 'add', text: after }
    ];
  }

  const patches = lcsDiff(a, b, (x, y) => x === y);

  const segments: DiffSegment[] = [];
  for (const patch of patches) {
    // 相邻的同类片段合成一段；`remove` 与 `add` 即使相邻也保持分开，否则高亮会串色
    const last = segments[segments.length - 1];
    if (last && last.op === patch.op) last.text += patch.value;
    else segments.push({ op: patch.op, text: patch.value });
  }
  return segments;
}

/**
 * 主入口：逐行差异。
 *
 * 配对规则：一段连续的「删除 + 新增」里，第 k 条删除行与第 k 条新增行配对做
 * 词级比较，多余的行整行标红或标绿。这样「改了第 2 条的措辞」会显示成
 * 一行内的词级高亮，而不是「删了 3 行又加了 3 行」这种看不出所以然的块。
 */
export function diffLines(before: string, after: string): DiffLine[] {
  // 尾随换行会让「行数」凭空多一，先规整
  const beforeLines = before.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const afterLines = after.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');

  if (beforeLines.length > MAX_LINES || afterLines.length > MAX_LINES) {
    return [
      ...beforeLines.map((line, index) => ({
        op: 'remove' as const,
        segments: [{ op: 'remove' as const, text: line }],
        beforeLine: index + 1,
        afterLine: null
      })),
      ...afterLines.map((line, index) => ({
        op: 'add' as const,
        segments: [{ op: 'add' as const, text: line }],
        beforeLine: null,
        afterLine: index + 1
      }))
    ];
  }

  const patches = lcsDiff(beforeLines, afterLines, (x, y) => x === y);
  const result: DiffLine[] = [];

  let beforeNo = 1;
  let afterNo = 1;
  let index = 0;

  while (index < patches.length) {
    const patch = patches[index];

    if (patch.op === 'same') {
      result.push({
        op: 'same',
        segments: [{ op: 'same', text: patch.value }],
        beforeLine: beforeNo,
        afterLine: afterNo
      });
      beforeNo += 1;
      afterNo += 1;
      index += 1;
      continue;
    }

    // 收集这一段连续改动里的删除行与新增行
    const removed: string[] = [];
    const added: string[] = [];
    while (index < patches.length && patches[index].op !== 'same') {
      if (patches[index].op === 'remove') removed.push(patches[index].value);
      else added.push(patches[index].value);
      index += 1;
    }

    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k += 1) {
      result.push({
        op: 'remove',
        segments: diffTokens(removed[k], added[k]),
        beforeLine: beforeNo,
        afterLine: afterNo
      });
      beforeNo += 1;
      afterNo += 1;
    }
    // 多出来的删除行：原文有、改写后没有
    for (let k = paired; k < removed.length; k += 1) {
      result.push({
        op: 'remove',
        segments: [{ op: 'remove', text: removed[k] }],
        beforeLine: beforeNo,
        afterLine: null
      });
      beforeNo += 1;
    }
    // 多出来的新增行：改写后多出来的
    for (let k = paired; k < added.length; k += 1) {
      result.push({
        op: 'add',
        segments: [{ op: 'add', text: added[k] }],
        beforeLine: null,
        afterLine: afterNo
      });
      afterNo += 1;
    }
  }

  return result;
}

export interface DiffStats {
  added: number;
  removed: number;
  same: number;
  /** 列宽变化，正数表示变长 */
  lengthDelta: number;
}

/** 汇总差异规模，用于「+12 −8 字」这类提示 */
export function summarizeDiff(before: string, after: string): DiffStats {
  const lines = diffLines(before, after);
  let added = 0;
  let removed = 0;
  let same = 0;

  for (const line of lines) {
    for (const segment of line.segments) {
      if (segment.op === 'add') added += segment.text.length;
      else if (segment.op === 'remove') removed += segment.text.length;
      else if (line.op !== 'same') same += segment.text.length;
    }
  }

  return {
    added,
    removed,
    same,
    lengthDelta: after.replace(/\s+/g, '').length - before.replace(/\s+/g, '').length
  };
}