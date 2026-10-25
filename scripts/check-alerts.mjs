/**
 * 可观测性告警检查（T5.6）。
 *
 * 读 `telemetry_daily` 的最近一天聚合，按阈值判断是否需要人来看一眼：
 *   - 导出失败率  = export.*.fail / (export.*.ok + export.*.fail)
 *   - 登录失败率  = auth.login.fail / (auth.login.fail + auth.login.ok)
 *   - 服务端错误  = server.error.5xx 的绝对次数
 *
 * 为什么是「脚本 + 退出码」而不是接一个告警平台：
 * 仓库里没有告警服务的凭据，也不该有。退出码非 0 在 GitHub Actions 里
 * 就是失败的红叉，在 cron + 任意通知脚本里就是「有情况」，两条路都通。
 *
 * 用法：
 *   node scripts/check-alerts.mjs                 # 查最近 1 天
 *   node scripts/check-alerts.mjs --days=7        # 查最近 7 天合计
 *   node scripts/check-alerts.mjs --local         # 本地 D1
 *   node scripts/check-alerts.mjs --dry-run       # 只打印 SQL，不执行
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_NAME = process.env.D1_DATABASE_NAME || 'open-resume-db';
const WRANGLER = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const dryRun = args.includes('--dry-run');
const daysArg = args.find((arg) => arg.startsWith('--days='));
const days = daysArg ? Math.max(1, Math.min(90, Number(daysArg.split('=')[1]) || 1)) : 1;

/**
 * 阈值。宁可一开始宽松：
 * 告警频繁误报的直接后果是没人再看告警，比没有告警更糟。
 */
const THRESHOLDS = {
  /** 导出失败率：超过 5% 说明某个格式真的坏了 */
  exportFailureRate: 0.05,
  /** 登录失败率：超过 40% 多半是在被撞库，或登录链路坏了 */
  loginFailureRate: 0.4,
  /** 5xx 绝对次数：一天超过 20 次就值得查 */
  serverErrors: 20,
  /** 任一指标的分母小于它时不判定，避免「2 次请求里失败 1 次 = 50%」 */
  minSample: 10
};

const cutoff = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);

function runSql(sql) {
  if (dryRun) {
    console.log(`  [dry-run] ${sql}`);
    return [];
  }
  const target = isLocal ? '--local' : '--remote';
  const output = execFileSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', DB_NAME, target, '--json', `--command=${sql}`],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  try {
    return JSON.parse(output)?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

/** 失败率；分母太小返回 null（样本不足，不判定） */
export function failureRate(ok, fail, minSample = THRESHOLDS.minSample) {
  const total = ok + fail;
  if (total < minSample) return null;
  return fail / total;
}

const rows = runSql(
  `SELECT name, SUM(count) AS count FROM telemetry_daily WHERE day >= '${cutoff}' GROUP BY name`
);

const exportOkCount = rows
  .filter((row) => /^export\..*\.ok$/.test(String(row.name)))
  .reduce((sum, row) => sum + Number(row.count || 0), 0);
const exportFailCount = rows
  .filter((row) => /^export\..*\.fail$/.test(String(row.name)))
  .reduce((sum, row) => sum + Number(row.count || 0), 0);
const loginOkCount = Number(rows.find((row) => row.name === 'auth.login.ok')?.count || 0);
const loginFailCount = Number(rows.find((row) => row.name === 'auth.login.fail')?.count || 0);
const serverErrorCount = rows
  .filter((row) => /^server\.error\.5\d\d$/.test(String(row.name)))
  .reduce((sum, row) => sum + Number(row.count || 0), 0);

const checks = [];

const exportRate = failureRate(exportOkCount, exportFailCount);
checks.push({
  name: '导出失败率',
  detail: `${exportFailCount}/${exportOkCount + exportFailCount}`,
  rate: exportRate,
  breached: exportRate !== null && exportRate > THRESHOLDS.exportFailureRate,
  threshold: `> ${(THRESHOLDS.exportFailureRate * 100).toFixed(0)}%`
});

const loginRate = failureRate(loginOkCount, loginFailCount);
checks.push({
  name: '登录失败率',
  detail: `${loginFailCount}/${loginOkCount + loginFailCount}`,
  rate: loginRate,
  breached: loginRate !== null && loginRate > THRESHOLDS.loginFailureRate,
  threshold: `> ${(THRESHOLDS.loginFailureRate * 100).toFixed(0)}%`
});

checks.push({
  name: '服务端 5xx',
  detail: `${serverErrorCount} 次`,
  rate: null,
  breached: serverErrorCount > THRESHOLDS.serverErrors,
  threshold: `> ${THRESHOLDS.serverErrors} 次`
});

console.log(`\n可观测性告警检查（最近 ${days} 天，自 ${cutoff}）\n`);
for (const check of checks) {
  const status = check.breached ? '⚠ 超阈值' : '✅ 正常';
  const value =
    check.rate === null ? check.detail : `${check.detail}（${(check.rate * 100).toFixed(1)}%）`;
  console.log(`  ${status}  ${check.name}: ${value}  阈值 ${check.threshold}`);
}

const breached = checks.filter((check) => check.breached);
if (breached.length) {
  console.error(`\n❌ ${breached.length} 项超过阈值：${breached.map((c) => c.name).join('、')}`);
  process.exit(1);
}

console.log('\n✅ 所有指标在阈值内');
