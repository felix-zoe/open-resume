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
