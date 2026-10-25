#!/usr/bin/env node
/**
 * 部署前环境校验。
 *
 * 解决的问题：`wrangler.toml` 里的 `[vars]` 会随仓库公开，生产环境必须用 Secret 覆盖。
 * 但 Secret 是否真的注入过，只有部署后第一次登录才会暴露 —— 那时线上已经挂了。
 * 这个脚本把「缺失的 Secret」提前到部署前发现，并直接给出修复命令。
 *
 * 用法：
 *   node scripts/check-env.mjs            # 检查当前环境变量
 *   node scripts/check-env.mjs --remote   # 同时检查 wrangler secret 列表（需已登录）
 *   node scripts/check-env.mjs --local    # 只检查本地 .dev.vars
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const args = process.argv.slice(2);
const checkLocal = args.includes('--local') || !args.includes('--remote');
const checkRemote = args.includes('--remote');

const problems = [];
const notes = [];

/** 读取 .dev.vars（wrangler 的本地变量文件格式：KEY=value，支持 # 注释） */
function readDevVars() {
  const file = path.join(ROOT, '.dev.vars');
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function fail(title, fix) {
  problems.push({ title, fix });
}

// ---------------- 本地 ----------------
if (checkLocal) {
  const devVars = readDevVars();
  if (!devVars) {
    notes.push('未找到 .dev.vars（本地开发可先 `cp .dev.vars.example .dev.vars`）');
  } else {
    if (!devVars.JWT_SECRET) {
      fail(
        '.dev.vars 中 JWT_SECRET 为空',
        '生成一个强随机值写入 .dev.vars：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"'
      );
    } else if (devVars.JWT_SECRET.length < 32) {
      fail('JWT_SECRET 过短（< 32 字符），HS256 密钥应至少 32 字节', '重新生成一个更长的随机值');
    }

    if (devVars.APP_ORIGIN && !/^https?:\/\//.test(devVars.APP_ORIGIN)) {
      fail(
        'APP_ORIGIN 必须带协议（http:// 或 https://），否则浏览器不会把它当作合法源',
        '改为 APP_ORIGIN=http://localhost:5173'
      );
    }
  }
}

// ---------------- 远程 ----------------
if (checkRemote) {
  let secrets = [];
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['wrangler', 'pages', 'secret', 'list', '--project-name', 'open-resume'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
    );
    secrets = out
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((name) => name && name !== 'Name' && !name.startsWith('─'));
  } catch (err) {
    notes.push(
      `无法读取远程 Secret 列表（可能未登录 wrangler）：${String(err.stderr || err.message).split('\n')[0]}`
    );
  }

  if (secrets.length) {
    if (!secrets.includes('JWT_SECRET')) {
      fail(
        '生产环境未注入 JWT_SECRET Secret —— wrangler.toml 里的明文值会随仓库公开',
        'npx wrangler pages secret put JWT_SECRET --project-name open-resume'
      );
    }
    notes.push(`已注入的 Secret：${secrets.join(', ')}`);
  }
}

// ---------------- 输出 ----------------
if (notes.length) {
  for (const note of notes) console.log(`ℹ️  ${note}`);
}

if (problems.length) {
  console.error('\n❌ 环境检查未通过：');
  for (const [index, problem] of problems.entries()) {
    console.error(`\n  ${index + 1}. ${problem.title}`);
    console.error(`     修复：${problem.fix}`);
  }
  process.exit(1);
}

console.log('\n✅ 环境检查通过');
