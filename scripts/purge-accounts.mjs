/**
 * 定时清理：到期注销的账号、过期访问记录、过期限流行、过期运行指标。
 *
 * 为什么需要这个脚本：注销的「到期删除」如果只靠用户下次登录时惰性执行，
 * 那些注销后就再没回来的人会永远留在库里 —— 而这恰恰是最该被删的一批。
 *
 * 用法：
 *   node scripts/purge-accounts.mjs --local --dry-run   # 先看会删什么
 *   node scripts/purge-accounts.mjs --local
 *   node scripts/purge-accounts.mjs --remote
 *
 * 生产建议挂 Cloudflare Cron Trigger 每日跑一次。
 * 本地跑 `--remote` 需要已登录 wrangler。
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_NAME = process.env.D1_DATABASE_NAME || 'open-resume-db';

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const dryRun = args.includes('--dry-run');
const target = isRemote ? '--remote' : '--local';

/** 与 functions/lib/account.ts 的 DELETION_GRACE_SECONDS 保持一致 */
const GRACE_SECONDS = 7 * 24 * 3600;
/** 与 functions/lib/account.ts 的 RETENTION.visitDays 保持一致 */
const VISIT_RETENTION_DAYS = 180;

const now = Math.floor(Date.now() / 1000);
const deletionCutoff = now - GRACE_SECONDS;
const visitCutoff = now - VISIT_RETENTION_DAYS * 86400;
const rateLimitCutoff = now - 86400;

/**
 * 直接跑 wrangler 的 JS 入口而不是 `npx wrangler`。
 *
 * 原因与 scripts/migrate.mjs 相同：Windows 下走 shell 会把 `--command=SELECT a FROM b`
 * 拆成多个 token，SQL 静默变成 `SELECT` 并失败。execFileSync 传数组可以避开。
 */
const WRANGLER = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function runSql(sql, label) {
  console.log(`\n▶ ${label}`);
  if (dryRun) {
    console.log(`  [dry-run] ${sql.replace(/\s+/g, ' ').slice(0, 200)}`);
    return [];
  }

  const output = execFileSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', DB_NAME, target, '--json', `--command=${sql}`],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  try {
    const parsed = JSON.parse(output);
    const rows = parsed?.[0]?.results ?? [];
    console.log(`  ${rows.length} 行`);
    return rows;
  } catch {
    console.log('  （无 JSON 输出）');
    return [];
  }
}

// 1. 找出到期注销的账号
const expiredUsers = runSql(
  `SELECT id, email FROM users WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= ${deletionCutoff}`,
  '查找注销冷静期已过的账号'
);

for (const user of expiredUsers) {
  console.log(`  注销 ${user.email} (${user.id})`);
  if (dryRun) continue;

  // 顺序与 functions/api/[[route]].ts 的 purgeUserAccount() 一致：子表 → 主表
  const statements = [
    `DELETE FROM resume_versions WHERE user_id = '${user.id}'`,
    `DELETE FROM share_links WHERE user_id = '${user.id}'`,
    `DELETE FROM job_applications WHERE user_id = '${user.id}'`,
    `DELETE FROM resume_visits WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = '${user.id}')`,
    `DELETE FROM resumes WHERE user_id = '${user.id}'`,
    `DELETE FROM users WHERE id = '${user.id}'`
  ];
  for (const sql of statements) {
    try {
      runSql(sql, `  清理 ${user.id}`);
    } catch (err) {
      console.error(`  ⚠ 清理失败（继续后续表）：${err.message}`);
    }
  }
}

// 2. 过期访问记录（保留 180 天）
runSql(
  `DELETE FROM resume_visits WHERE created_at < ${visitCutoff}`,
  `清理 ${VISIT_RETENTION_DAYS} 天前的访问记录`
);

// 3. 过期限流窗口行（保留 1 天）
runSql(`DELETE FROM rate_limits WHERE window_start < ${rateLimitCutoff}`, '清理过期限流计数');

// 4. 过期运行指标（保留 90 天，与隐私政策「运行指标」一节一致）
const telemetryCutoff = new Date(now * 1000 - 90 * 86400_000).toISOString().slice(0, 10);
runSql(`DELETE FROM telemetry_daily WHERE day < '${telemetryCutoff}'`, '清理 90 天前的运行指标');

console.log(`\n✅ 清理完成${dryRun ? '（dry-run，未写入）' : ''}`);
