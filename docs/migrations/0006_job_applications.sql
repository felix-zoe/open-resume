-- 0006_job_applications.sql — 投递管理（T5.1 / 4.2.9）
--
-- 定位：记录「投了哪家、投的哪份简历、进展到哪一步、下一步什么时候做」。
-- 不做投递渠道对接、不发邮件，只做一个本地可用的看板。
--
-- 设计取舍：
-- · `resume_id` 允许为空 —— 有些岗位是线下/内推投的，没有对应简历文件；
-- · 删除简历时用 `ON DELETE SET NULL` 而不是 CASCADE：投递记录是用户的求职历史，
--   删掉一份简历不该让「我上个月投过这家」的记忆一起消失；
-- · `status` 存字符串而非枚举整数，D1 里直接读得懂，加新状态不需要迁移；
-- · `next_action_at` 用于「跟进提醒」，为空表示没有待办。

CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    resume_id TEXT,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    location TEXT,
    channel TEXT,                          -- 投递渠道：官网 / 内推 / 招聘平台 / 猎头
    status TEXT NOT NULL DEFAULT 'applied', -- saved | applied | interviewing | offer | rejected
    applied_at INTEGER,                     -- 投递日期（秒）；status=saved 时为空
    next_action_at INTEGER,                 -- 下次跟进日期（秒）
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

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0006_job_applications');
