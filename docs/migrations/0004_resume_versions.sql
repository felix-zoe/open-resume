-- 0004_resume_versions.sql — 版本历史（T1.6 / 4.2.2 / CUT-06）
--
-- 与旧 `resume_history` 的差异：
-- · 只在「内容真的变了」且距上次 ≥10 分钟时写快照（旧实现每 3 分钟无条件写，
--   同一份内容会堆出几十条一模一样的记录）；
-- · 存 content_hash，用于判断是否重复，也便于前端显示「无改动」；
-- · 保留每份简历最近 20 个版本，超出自动清理；
-- · 允许手动命名（label），用于「投递前定稿」这类节点。

CREATE TABLE IF NOT EXISTS resume_versions (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    label TEXT,
    title TEXT NOT NULL,
    template_id TEXT NOT NULL,
    content TEXT NOT NULL,
    theme_config TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'auto',   -- auto | manual | restore
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_versions_resume ON resume_versions(resume_id, created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0004_resume_versions');
