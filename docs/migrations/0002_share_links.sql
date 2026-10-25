-- 0002_share_links.sql — token 化分享链接（T1.4 / 4.2.3 / SHARE-03、SHARE-04）
--
-- 设计取舍：
-- · 链接身份用不可猜测的随机 token，而不是简历 id —— 简历 id 会出现在
--   编辑器地址栏与工作台，天然可枚举，无法承担「私密投递」的语义。
-- · 密码只存 PBKDF2 哈希（复用 functions/lib/security.ts），不存明文。
-- · 有效期用 expires_at 秒级时间戳；NULL 表示永久有效。
-- · revoked_at 采用软删除：撤销后仍保留记录，便于审计「这个链接曾被谁用过」。
-- · mask_contact 默认 1：默认不把完整手机号/邮箱暴露给所有拿到链接的人。

CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    password_hash TEXT,
    expires_at INTEGER,
    allow_download INTEGER NOT NULL DEFAULT 1,
    mask_contact INTEGER NOT NULL DEFAULT 1,
    revoked_at INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_resume ON share_links(resume_id);
CREATE INDEX IF NOT EXISTS idx_share_links_user ON share_links(user_id);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0002_share_links');
