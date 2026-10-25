-- 0007_account_lifecycle.sql — 账号生命周期（T5.5 / 4.2.10 剩余）
--
-- 只加一列：注销申请的发起时间。
--
-- 设计取舍：
-- · **不做物理删除标记**（`is_deleted`）：注销是一个有截止时间的流程，不是一种状态。
--   存 `deletion_requested_at` 就能算出「还剩几天」，也能在登录时判断是否已到期；
-- · 冷静期内登录即自动撤销（清空该列）—— 用户能登进来，说明他后悔了，
--   这时再让他去某个页面点「撤销」是多此一举；
-- · 到期后的清理既可以在登录时惰性执行，也可以由 `scripts/purge-accounts.mjs`
--   定时跑（长期不登录的账号不会一直留在库里）。
--
-- 邮件验证与密码重置不在本次范围：它们依赖邮件服务商凭据，
-- 仓库里不该有、也无法在本地验证。见执行状态文档 T5.5 偏差说明。

ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER;

-- 清理脚本按该列扫描「已到期」的账号
CREATE INDEX IF NOT EXISTS idx_users_deletion ON users(deletion_requested_at);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0007_account_lifecycle');
