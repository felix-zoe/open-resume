#!/usr/bin/env node
/**
 * 类名 codemod：把散落的色板统一到设计令牌。
 *
 * 规则：
 * 1. `gray-*` → `slate-*`（全项目，含简历模板）
 * 2. chrome 层（components / views / modules）的
 *    `blue|indigo|purple|sky|violet-*` → `primary-*`
 * 3. 简历模板（src/templates）里的链接色改为中性色：
 *    `text-blue-600` / `text-blue-500` → `text-slate-700 underline`
 *
 * 只替换类名 token，不碰十六进制色值、themeColor 默认值、docs。
 *
 * 用法：
 *   node scripts/codemod-classes.mjs --dry   仅统计
 *   node scripts/codemod-classes.mjs         实际写入
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DRY = process.argv.includes('--dry');

const CHROME_PREFIXES = [
  'text', 'bg', 'border', 'ring', 'from', 'via', 'to', 'divide',
  'placeholder', 'accent', 'shadow', 'outline', 'decoration', 'fill', 'stroke'
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(vue|ts|js|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

const stats = new Map();
function record(key, file) {
  const entry = stats.get(key) ?? { count: 0, files: new Set() };
  entry.count += 1;
  entry.files.add(rel(file));
  stats.set(key, entry);
}

/** 把 token 中的颜色词替换掉，保留透明度后缀（如 /20） */
function replaceColor(token, fromColors, toColor) {
  const match = token.match(/^([a-z]+)-([a-z]+)-(\d{2,3})(\/\d+)?$/);
  if (!match) return null;
  const [, prefix, color, shade, alpha = ''] = match;
  if (!CHROME_PREFIXES.includes(prefix)) return null;
  if (!fromColors.includes(color)) return null;
  return `${prefix}-${toColor}-${shade}${alpha}`;
}

function transform(text, file) {
  const isTemplate = rel(file).startsWith('src/templates/');

  return text.replace(/\b([a-z]+)-([a-z]+)-(\d{2,3})(\/\d+)?\b/g, (token) => {
    const relPath = rel(file);

    // 模板链接：统一为中性色 + 下划线（简历文档不使用产品主色）
    if (isTemplate && (token === 'text-blue-600' || token === 'text-blue-500')) {
      record(`${relPath === '' ? '' : ''}${token} → text-slate-700 underline`, file);
      return 'text-slate-700 underline';
    }

    // 规则 1：gray → slate
    const slate = replaceColor(token, ['gray'], 'slate');
    if (slate) {
      record(`${token} → ${slate}`, file);
      return slate;
    }

    // 规则 2：chrome 层品牌色收敛
    if (!isTemplate && relPath.startsWith('src/')) {
      const primary = replaceColor(token, ['blue', 'indigo', 'purple', 'sky', 'violet'], 'primary');
      if (primary) {
        record(`${token} → ${primary}`, file);
        return primary;
      }
    }

    return token;
  });
}

const files = walk(SRC);
let changedFiles = 0;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before, file);
  if (after !== before) {
    changedFiles += 1;
    if (!DRY) fs.writeFileSync(file, after, 'utf8');
  }
}

const sorted = [...stats.entries()].sort((a, b) => b[1].count - a[1].count);

console.log(DRY ? '🔍 codemod 预演（未写入）\n' : '✍️  codemod 已写入\n');
for (const [key, value] of sorted) {
  console.log(`  ${String(value.count).padStart(4)}  ${key}`);
}
console.log(`\n涉及 ${changedFiles} 个文件，共 ${sorted.reduce((sum, [, v]) => sum + v.count, 0)} 处替换`);
