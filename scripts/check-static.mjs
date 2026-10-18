#!/usr/bin/env node
/**
 * 静态守卫：把“已经修过的一类问题”变成不可回退的规则。
 *
 * 设计原则：
 * - 零依赖，只用 Node 内置模块；
 * - 每条规则在修复对应任务的同一次改动中加入，避免一次性引入大量失败；
 * - 输出具体文件与行号，便于直接定位。
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'src');
const violations = [];

/**
 * 规则开关：每条规则在“修复它的那个任务”中翻为 true。
 * 这样可以先落地守卫骨架，而不让尚未修复的存量问题阻塞当前任务。
 */
const RULES = {
  invalidSpacingToken: true,   // T0.2
  cloudPdfRemoved: true,       // T0.7
  unsafeTemplateHref: true,    // T0.3
  staticAssets: true,          // T0.12 前已补齐，直接启用
  buildOutput: true,           // T0.2
  noNativeDialogs: true,       // T1.5
  noGrayTokens: true,          // T1.2
  noSmallFonts: true,          // T1.2b
  brandSolidInUiOnly: true     // T1.12
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(SRC).filter((f) => /\.(vue|ts|js|css)$/.test(f));

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function addViolation(rule, file, line, detail) {
  violations.push({ rule, file: rel(file), line, detail });
}

/** 逐行扫描，命中即记录 */
function scanLines(files, rule, test) {
  for (const file of files) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((text, index) => {
      const detail = test(text, file);
      if (detail) addViolation(rule, file, index + 1, detail);
    });
  }
}

// ---------------------------------------------------------------------------
// 规则 1：禁止 Tailwind 中不存在的任意间距写法（T0.2 起）
// ---------------------------------------------------------------------------
if (RULES.invalidSpacingToken) {
  scanLines(sourceFiles, 'invalid-spacing-token', (line) => {
    const match = line.match(/\b(?:py|px|pt|pb|pl|pr|mt|mb|ml|mr|gap|space-[xy])-0\.2\b/);
    return match ? `发现无效间距类 ${match[0]}` : null;
  });
}

// ---------------------------------------------------------------------------
// 规则 2：禁止云端 PDF 残留（T0.7 起）
// ---------------------------------------------------------------------------
const cloudPdfFiles = [
  ...sourceFiles,
  ...walk(path.join(ROOT, 'functions')).filter((f) => /\.(ts|js)$/.test(f))
];
if (RULES.cloudPdfRemoved) {
  scanLines(cloudPdfFiles, 'cloud-pdf-removed', (line) => {
    if (/@cloudflare\/puppeteer|\bMYBROWSER\b|['"`]\/api\/export-pdf/.test(line)) {
      return '云端 PDF 导出已下线，禁止引用 puppeteer / MYBROWSER / /api/export-pdf';
    }
    return null;
  });

  const wranglerPath = path.join(ROOT, 'wrangler.toml');
  if (fs.existsSync(wranglerPath)) {
    const text = read(wranglerPath);
    if (/\[browser\]/.test(text) || /MYBROWSER/.test(text)) {
      addViolation('cloud-pdf-removed', wranglerPath, 1, 'wrangler.toml 仍包含 Browser Rendering 绑定');
    }
  }
}

// ---------------------------------------------------------------------------
// 规则 3：模板中的外链必须经过 safeUrl（T0.3 起）
// ---------------------------------------------------------------------------
const templateFiles = walk(path.join(SRC, 'templates')).filter((f) => f.endsWith('.vue'));
if (RULES.unsafeTemplateHref) {
  scanLines(templateFiles, 'unsafe-template-href', (line) => {
    if (/:href="(?:profile|item)\.(?:github|website|link)"/.test(line)) {
      return '模板外链必须通过 safeUrl() 校验协议';
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// 规则 4：色板收敛（T1.2 起）
//   - 全项目禁止 gray-*（统一 slate）
//   - chrome 层禁止 blue/indigo/purple/sky/violet（统一 primary）
// ---------------------------------------------------------------------------
if (RULES.noGrayTokens) {
  scanLines(sourceFiles, 'no-gray-tokens', (line) => {
    const match = line.match(
      /\b(?:text|bg|border|ring|from|via|to|divide|placeholder|accent|shadow|outline|decoration|fill|stroke)-gray-\d{2,3}\b/
    );
    return match ? `使用 gray 色板，请改为 slate：${match[0]}` : null;
  });

  const chromeFiles = sourceFiles.filter((f) =>
    /[\\/]src[\\/](components|views|modules)[\\/]/.test(f)
  );
  scanLines(chromeFiles, 'no-legacy-brand-tokens', (line) => {
    const match = line.match(
      /\b(?:text|bg|border|ring|from|via|to|divide|placeholder|accent|shadow|outline|decoration|fill|stroke)-(?:blue|indigo|purple|sky|violet)-\d{2,3}\b/
    );
    return match ? `使用旧品牌色，请改为 primary：${match[0]}` : null;
  });
}

// ---------------------------------------------------------------------------
// 规则 5：禁止原生弹窗（T1.5 起）
//   `askConfirm` / `resolveConfirm` 是自有实现，不匹配裸 `confirm(`
// ---------------------------------------------------------------------------
if (RULES.noNativeDialogs) {
  scanLines(sourceFiles, 'no-native-dialogs', (line) => {
    if (/(^|[^.\w])alert\s*\(/.test(line)) {
      return '禁止使用原生 alert()，请改用 useToast()';
    }
    if (/(^|[^.\w])confirm\s*\(/.test(line) && !/askConfirm|resolveConfirm|function confirm/.test(line)) {
      return '禁止使用原生 confirm()，请改用 askConfirm()';
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// 规则 6：字号下限（T1.2b 起）
// ---------------------------------------------------------------------------
if (RULES.noSmallFonts) {
  scanLines(sourceFiles, 'no-small-fonts', (line) => {
    const match = line.match(/text-\[\d{1,2}px\]/);
    return match ? `禁止小于 11px 的任意字号 ${match[0]}，请用 text-2xs` : null;
  });
}

// ---------------------------------------------------------------------------
// 规则 7：品牌实色只允许出现在 UI 原语（T1.12 起）
//   页面层必须复用 AppButton / BrandMark，避免每个页面各写一套主按钮样式。
// ---------------------------------------------------------------------------
if (RULES.brandSolidInUiOnly) {
  const uiDir = path.join(SRC, 'components', 'ui');
  const nonUiFiles = sourceFiles.filter((f) => !f.startsWith(uiDir + path.sep));
  scanLines(nonUiFiles, 'brand-solid-in-ui-only', (line) => {
    const match = line.match(/\bbg-primary-600\b/);
    return match
      ? 'bg-primary-600 只允许出现在 src/components/ui/**，请改用 AppButton / BrandMark'
      : null;
  });
}

// ---------------------------------------------------------------------------
// 规则 6：静态资源与 SPA 回退（T0.12 起）
// ---------------------------------------------------------------------------
const faviconPath = path.join(ROOT, 'public', 'favicon.svg');
const redirectsPath = path.join(ROOT, 'public', '_redirects');

if (!fs.existsSync(faviconPath)) {
  addViolation('static-assets', faviconPath, 0, '缺少 public/favicon.svg');
}
if (!fs.existsSync(redirectsPath)) {
  addViolation('static-assets', redirectsPath, 0, '缺少 public/_redirects');
} else if (!/^\s*\/\*\s+\/index\.html\s+200\s*$/m.test(read(redirectsPath))) {
  addViolation('static-assets', redirectsPath, 1, '缺少 SPA 回退规则 /* /index.html 200');
}

// ---------------------------------------------------------------------------
// 规则 5：构建产物检查（仅在 dist 存在时）
// ---------------------------------------------------------------------------
const distAssets = path.join(ROOT, 'dist', 'assets');
if (fs.existsSync(distAssets)) {
  const assets = fs.readdirSync(distAssets);
  const cssFiles = assets.filter((f) => f.endsWith('.css'));
  const jsFiles = assets.filter((f) => f.endsWith('.js'));

  if (cssFiles.length === 0) {
    addViolation('build-output', distAssets, 0, '构建产物中没有 CSS');
  } else {
    const css = cssFiles.map((f) => read(path.join(distAssets, f))).join('\n');
    for (const token of ['.shadow-2xs', '.shadow-xs']) {
      if (!css.includes(token)) {
        addViolation('build-output', path.join(distAssets, cssFiles[0]), 0, `构建 CSS 缺少 ${token} 规则`);
      }
    }
  }

  if (jsFiles.length === 0) {
    addViolation('build-output', distAssets, 0, '构建产物中没有 JS');
  } else {
    // 路由懒加载生效时应至少有 3 个 chunk（入口 + 若干异步页面）
    if (jsFiles.length < 3) {
      addViolation(
        'build-output',
        distAssets,
        0,
        `JS chunk 只有 ${jsFiles.length} 个，路由懒加载可能失效`
      );
    }

    // 首屏 JS 预算：取最大的 chunk 作为主包（懒加载后应仍为入口包）
    const sizes = jsFiles.map((f) => {
      const buf = fs.readFileSync(path.join(distAssets, f));
      return { file: f, gzip: zlib.gzipSync(buf).length };
    });
    const largest = sizes.sort((a, b) => b.gzip - a.gzip)[0];
    if (largest.gzip > 160 * 1024) {
      addViolation(
        'build-output',
        path.join(distAssets, largest.file),
        0,
        `最大 JS chunk gzip ${(largest.gzip / 1024).toFixed(1)}KB 超出 160KB 预算`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
if (violations.length === 0) {
  console.log('✅ check:static 通过');
  process.exit(0);
}

console.error(`❌ check:static 发现 ${violations.length} 处问题：\n`);
for (const v of violations) {
  const location = v.line > 0 ? `${v.file}:${v.line}` : v.file;
  console.error(`  [${v.rule}] ${location}\n    ${v.detail}`);
}
process.exit(1);
