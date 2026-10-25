-- 0003_visits_dedup.sql — 访问统计去伪（T1.5 / SHARE-01、SHARE-02）
--
-- 背景：旧实现每收到一次上报就插一行，导致
--   · 同一个 HR 刷新三次 = 3 次浏览；
--   · 本人预览自己的简历也被计入；
--   · 下载后离开页面又记一次。
--
-- 新增字段：
-- · visitor_hash   —— sha256(IP + UA + resume_id) 的短哈希，用于 30 分钟内去重。
--                     只存哈希不存 IP，既满足去重，又不留可识别个人身份的原始数据。
-- · country        —— 来自 Cloudflare 的 cf.country，仅做地区分布参考。
-- · referer        —— 来源域名，判断链接是从招聘平台还是 IM 打开。
-- · is_bot         —— 标记被过滤的爬虫请求，保留计数便于排查误杀。

ALTER TABLE resume_visits ADD COLUMN visitor_hash TEXT;
ALTER TABLE resume_visits ADD COLUMN country TEXT;
ALTER TABLE resume_visits ADD COLUMN referer TEXT;
ALTER TABLE resume_visits ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_visits_visitor ON resume_visits(resume_id, visitor_hash, created_at);

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('0003_visits_dedup');
