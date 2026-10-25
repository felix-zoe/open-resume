#!/usr/bin/env node
/**
 * D1 迁移执行器。
 *
 * 为什么不用 `wrangler d1 execute --file` 一个个跑：
 * · 迁移文件是有序的，靠人工记「跑到第几个」必然出错；
 * · 每个文件末尾都写了 `INSERT OR IGNORE INTO schema_migrations`，
 *   但只有先查一次已应用列表才能跳过重复执行；
 * · 失败时要立刻停下，而不是继续跑后续迁移把库改到半新半旧的状态。
 *
 * 用法：
 *   node scripts/migrate.mjs --local            # 本地 dev 库
 *   node scripts/migrate.mjs --remote           # 远程库
 *   node scripts/migrate.mjs --local --dry-run  # 只打印将要执行的文件
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const MIGRATIONS_DIR = path.join(ROOT, 'docs', 'migrations');
const DB_NAME = process.env.D1_DATABASE_NAME || 'open-resume-db';

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const dryRun = args.includes('--dry-run');
const target = isRemote ? '--remote' : '--local';

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error(`❌ 找不到迁移目录：${MIGRATIONS_DIR}`);
  process.exit(1);
}

/** 迁移文件按文件名排序，前缀数字保证顺序 */
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (!files.length) {
  console.log('没有可执行的迁移文件。');
  process.exit(0);
}

/**
 * 直接跑 wrangler 的 JS 入口，而不是 `npx wrangler`。
 *
 * 原因：Windows 下走 shell 时，node 只是把参数用空格拼起来，`--command=SELECT a FROM b`
 * 会被拆成 4 个 token，SQL 静默变成 `SELECT` 并失败 —— 表现为「迁移表永远查不到、
 * 每次都重跑全部迁移」。用 process.execPath + 脚本路径可以完全绕开 shell。
 */
const WRANGLER_BIN = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function wrangler(sqlOrFile, { file = false, json = false } = {}) {
  const cmdArgs = [WRANGLER_BIN, 'd1', 'execute', DB_NAME, target];
  if (file) cmdArgs.push(`--file=${sqlOrFile}`);
  else cmdArgs.push(`--command=${sqlOrFile}`);
  if (json) cmdArgs.push('--json');
  return execFileSync(process.execPath, cmdArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

/** 读取已应用的版本号；表不存在时视为空（首次迁移） */
function appliedVersions() {
  try {
    const out = wrangler('SELECT version FROM schema_migrations', { json: true });
    // --json 输出是数组：[{ results: [{ version: '0001_baseline' }], success: true }]
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed) ? parsed.flatMap((item) => item?.results ?? []) : [];
    const versions = rows.map((row) => row?.version).filter((v) => typeof v === 'string');
    if (versions.length) return new Set(versions);
    // 空表（首次迁移）与「查询失败」要区分：解析成功但没行 = 确实还没跑过
    return new Set();
  } catch (err) {
    // 表不存在时 wrangler 返回非零退出码，这里视为「没有任何迁移」
    const detail = String(err?.stderr || err?.message || '');
    if (/no such table/i.test(detail)) return new Set();
    throw new Error(`无法读取 schema_migrations：${detail.trim().split('\n')[0]}`);
  }
}

const applied = appliedVersions();
const pending = files.filter((name) => {
  const version = name.replace(/\.sql$/, '');
  return !applied.has(version);
});

if (!pending.length) {
  console.log(`✅ 所有迁移已应用（${files.length} 个）`);
  process.exit(0);
}

console.log(`目标：${isRemote ? '远程' : '本地'}库 ${DB_NAME}`);
console.log(`待执行 ${pending.length} / ${files.length} 个迁移：`);
for (const name of pending) console.log(`  · ${name}`);

if (dryRun) {
  console.log('\n--dry-run：未执行任何 SQL。');
  process.exit(0);
}

for (const name of pending) {
  const filePath = path.join(MIGRATIONS_DIR, name);
  process.stdout.write(`\n▶ ${name} ... `);
  try {
    wrangler(filePath, { file: true });
    console.log('ok');
  } catch (err) {
    console.log('失败');
    const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
    console.error(`\n❌ 迁移 ${name} 执行失败，已停止后续迁移。\n${detail}`);
    process.exit(1);
  }
}

console.log('\n✅ 全部迁移完成');
