-- Cloudflare D1 数据库初始化脚本
-- 执行命令示例: npx wrangler d1 execute open-resume-db --local --file=./docs/schema.sql
-- 远程执行: npx wrangler d1 execute open-resume-db --remote --file=./docs/schema.sql

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. 简历主表
CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '未命名简历',
    template_id TEXT NOT NULL DEFAULT 'classic',
    content TEXT NOT NULL,          -- 结构化简历数据 (JSON 字符串)
    theme_config TEXT NOT NULL,     -- 排版与样式配置 (JSON 字符串)
    is_public INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);

-- 3. 简历历史版本表 (用于撤销/版本恢复)
CREATE TABLE IF NOT EXISTS resume_history (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL,
    snapshot TEXT NOT NULL,         -- 历史快照数据 (JSON 字符串)
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_history_resume ON resume_history(resume_id);

-- 4. HR 阅读足迹表 (投递反馈与阅读时长追踪)
CREATE TABLE IF NOT EXISTS resume_visits (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    is_downloaded INTEGER NOT NULL DEFAULT 0,
    user_agent TEXT,
    visitor_hash TEXT,                     -- sha256(IP+UA+简历id) 短哈希，用于 30 分钟去重
    country TEXT,                          -- cf.country
    referer TEXT,                          -- 来源域名
    is_bot INTEGER NOT NULL DEFAULT 0,     -- 被识别为爬虫/预取
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visits_resume ON resume_visits(resume_id);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON resume_visits(resume_id, visitor_hash, created_at);

-- 5. token 化分享链接 (有效期 / 密码 / 联系方式脱敏)
CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    password_hash TEXT,
    expires_at INTEGER,                    -- NULL = 永久有效
    allow_download INTEGER NOT NULL DEFAULT 1,
    mask_contact INTEGER NOT NULL DEFAULT 1,
    revoked_at INTEGER,                    -- 软删除，保留审计痕迹
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_resume ON share_links(resume_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user ON share_links(user_id);

-- 6. 简历版本历史 (内容变化才写，每份保留 20 个)
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
    source TEXT NOT NULL DEFAULT 'auto',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_versions_resume ON resume_versions(resume_id, created_at DESC);

-- 7. 限流计数 (固定窗口，key = action:ip:windowIndex，保留 1 天)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- 8. 投递管理 (求职进度看板)
CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    resume_id TEXT,                          -- 可为空：线下/内推投递没有对应文件
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    location TEXT,
    channel TEXT,
    status TEXT NOT NULL DEFAULT 'applied',  -- saved | applied | interviewing | offer | rejected
    applied_at INTEGER,
    next_action_at INTEGER,
    next_action_note TEXT,
    salary_range TEXT,
    job_url TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON job_applications(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_next_action ON job_applications(user_id, next_action_at);

-- 9. 账号注销冷静期 (T5.5 / 0007_account_lifecycle.sql)
-- 存「申请时间」而不是布尔标记：能算出还剩几天，也能在登录时判断是否已到期。
-- 冷静期内登录自动撤销；到期后由 scripts/purge-accounts.mjs 或登录时惰性删除。
ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_users_deletion ON users(deletion_requested_at);

-- 10. 可观测性聚合 (T5.6 / 0008_telemetry.sql)
-- 只存「按天 × 事件名 × 归一化路径」的计数，没有 user_id / IP / 原始事件，
-- 因此这张表即使泄露也不构成个人数据；vital 的均值由 total_value / count 算出。
CREATE TABLE IF NOT EXISTS telemetry_daily (
    day TEXT NOT NULL,                    -- UTC 日期 YYYY-MM-DD
    kind TEXT NOT NULL,                   -- error | vital | event | server
    name TEXT NOT NULL,                   -- 事件名（如 export.pdf.ok）
    path TEXT NOT NULL DEFAULT '',        -- 归一化路径（/editor/:id）
    count INTEGER NOT NULL DEFAULT 0,
    total_value REAL NOT NULL DEFAULT 0,  -- vital 的累加值
    PRIMARY KEY (day, kind, name, path)
);
CREATE INDEX IF NOT EXISTS idx_telemetry_day ON telemetry_daily(day);

-- 11. 迁移版本记录 (见 docs/migrations/)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
