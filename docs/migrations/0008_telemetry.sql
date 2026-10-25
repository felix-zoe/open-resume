-- 0008_telemetry.sql — 可观测性（T5.6）
--
-- 只存「按天聚合的计数」，不存单条原始事件：
--   1. 免费版 D1 每天 10 万次写入，单条落库等于把配额全花在埋点上；
--   2. 聚合表里没有 user_id / ip / 原始路径，即使泄露也不构成个人数据。
--
-- 主键设计成 (day, kind, name, path)：同一格只累加，天然幂等可重放。

CREATE TABLE IF NOT EXISTS telemetry_daily (
    day TEXT NOT NULL,               -- UTC 日期 YYYY-MM-DD
    kind TEXT NOT NULL,              -- error | vital | event | server
    name TEXT NOT NULL,              -- 事件名（如 export.pdf、auth.login.fail）
    path TEXT NOT NULL DEFAULT '',   -- 归一化路径（/editor/:id），避免 id 撑爆基数
    count INTEGER NOT NULL DEFAULT 0,
    total_value REAL NOT NULL DEFAULT 0,  -- vital 的累加值，用于算均值
    PRIMARY KEY (day, kind, name, path)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_day ON telemetry_daily(day);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0008_telemetry');
