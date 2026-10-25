-- 0005_rate_limits.sql — 登录/注册/访客上报限流（T2.1 / SEC-05）
--
-- 固定窗口计数：key = `action:ip:windowIndex`，新窗口写新行，天然不需要
-- 「先判过期再重置」的竞态处理。旧行由 functions/lib/rate-limit.ts 的
-- pruneRateLimits() 在低频路径上清理（保留 1 天）。
--
-- 只存 IP 与动作，不存任何账号信息；窗口过期即删除。

CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0005_rate_limits');
