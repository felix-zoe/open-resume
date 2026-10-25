# OpenResume 极简开源简历制作平台

> 一款基于 **Vue 3** 构建、前后端完全托管于 **Cloudflare 免费生态**（Pages + Workers/Functions + D1 + R2）的现代化所见即所得简历制作平台。

---

## 🌟 核心特性

- 📄 **真实 A4 实时排版**：左侧结构化表单录入，右侧按真实分页结果渲染多张 1:1 A4 纸张，预览页数与打印页数一致。
- 🪄 **一页纸自适应神器**：内置模块与段落垂直间距微调滑块，经历较少可一键饱满填满，经历较多可一键紧缩防超页；支持目标页数与「撤销本次自动排版」。
- 🗂️ **多份简历管理**：工作台按模板缩略图与完整度进度条管理多份简历，网格/列表两种视图，新建可选「空白 / 示例 / 从已有复制」。
- 🖨️ **无水印高清矢量导出**：告别竞品导出收费与低清模糊截屏，基于现代浏览器原生 `@media print` 打印引擎，文字可选中、超链接可跳转、文件体积极小。
- 🎨 **数据与视图彻底解耦**：内置 4 套排版模板（经典通用型、极简极客型、现代双栏型、ATS 友好型），切换模板 100% 保持个人经历数据完整。
- 📤 **多格式导出与导入**：浏览器打印导出矢量 PDF，另支持 Word（.docx）、Markdown 与 JSON 备份；JSON / 粘贴文本 / Markdown 三种来源可导入。
- 🩺 **内容体检与岗位对照**：逐条检查量化数据、弱动词、占位符与长度；粘贴 JD 后按词频权重对照关键词覆盖（同义词已归一），只提示、不自动改写。
- 🤖 **AI 改写（自带 Key）**：接入你**自己的** API Key——预设 DeepSeek、阿里云百炼、智谱 GLM、月之暗面、火山方舟、百度千帆、腾讯混元、讯飞星火、硅基流动、MiniMax、阶跃星辰、百川智能 12 家，也可接任意 OpenAI 兼容端点（自建网关 / Ollama / One-API）。七种风格（润色 / 精简 / 突出成果 / STAR / 专业措辞 / 纠错 / 译英），**结果先出 diff、点「采纳」才写回**。Key 与正文不落库、不写日志，只送你在抽屉里选中的那一段。
- 📬 **投递管理**：记录投了哪家、用的哪份简历、进展到哪一步；看板/列表双视图、跟进提醒、面试率与 Offer 率统计（分母只算「已投递」，不含「想投」）。
- 🌐 **中英双语简历**：同一份简历可切换中/英文渲染（模块标题、日期格式、分隔符），内容一字不动；技能支持「整句描述 / 标签胶囊」两种形态，导出同步跟随语言。
- 🔎 **示例库与搜索友好**：6 个岗位示例页用真实模板渲染并附写法建议；`robots.txt`、`sitemap.xml` 与构建期 head 预渲染（`SoftwareApplication`/`FAQPage`/`BreadcrumbList` 结构化数据），营销页不依赖 JS 也能被正确抓取。
- 📴 **可安装、可离线**：装到桌面后断网也能打开编辑器继续写、照常打印；应用壳与预渲染页全部预缓存，简历数据不进缓存；有新版本只提示不自动刷新。
- 📈 **出问题能立刻知道**：前端错误与 Web Vitals（LCP/CLS/INP）上报到自建接口，业务埋点只记次数不记身份；服务端每个请求带 `X-Request-Id` 并输出结构化日志。不接任何第三方统计脚本。
- 🔐 **账号自己做主**：设置页可改密码（需校验当前密码）、一键导出全部数据为 JSON（不含密码哈希与访客统计）、申请注销并留 7 天反悔期（期间登录即自动撤销），到期由登录惰性删除或 `npm run db:purge:remote` 定时清理。
- ⚡ **零服务器成本云原生**：
  - 前端托管：Cloudflare Pages 全球 Anycast CDN 边缘分发
  - 后端接口：Cloudflare Workers / Pages Functions (Hono.js 框架)
  - 关系数据库：Cloudflare D1 (Serverless SQLite)
  - 对象存储：Cloudflare R2 (头像上传与图片分发)

---

## 📁 目录结构

```
open-resume/
├── docs/                   # 完整规划文档体系
│   ├── 产品需求文档.md      # 产品需求文档
│   ├── 需求规格说明书.md    # 详细功能规格说明书 (对标竞品细节)
│   ├── 接口文档.md          # RESTful 接口与 TypeScript 共享契约
│   ├── 优化与扩展方案.md    # v2.0 优化方案（目标态基线）
│   ├── 优化执行状态.md      # 方案执行进度与剩余工作计划
│   └── schema.sql          # Cloudflare D1 数据库初始化 SQL
├── functions/              # Cloudflare Pages Functions 后端 API (Hono)
│   ├── api/
│   │   └── [[route]].ts    # 统一 RESTful API 路由实现 (Auth, Resumes, R2 Upload, AI)
│   ├── lib/                # 纯函数模块 (security, rate-limit, telemetry, ai 网关…)
│   └── types.ts            # D1、R2 环境变量绑定定义
├── shared/                 # 前后端共享的纯类型与常量 (types.ts, ai.ts 厂商预设)
├── src/                    # 前端 Vue 3 核心应用
│   ├── assets/             # Tailwind 与打印 @media print 样式
│   ├── components/         # 导航栏、模板切换弹窗等通用组件
│   ├── modules/editor/     # 编辑器核心组件 (FormPanel, PreviewCanvas, StyleDrawer...)
│   ├── templates/          # 4 套模板 (Classic, Geek, Modern, ATS) + 共享样式 resume.css
│   ├── stores/             # Pinia 状态管理 (resume 状态机, auth)
│   ├── types/              # 前端 TypeScript 契约
│   ├── utils/              # 矢量打印驱动器、默认示范范文
│   └── views/              # 首页、工作台、编辑器、只读分享页、投递管理、简历示例库、账号设置
├── public/                 # 静态资源：favicon、OG 图、robots.txt、sitemap.xml、SPA 回退
├── scripts/                # 静态守卫、DB 迁移、到期账号清理、指标告警、环境自检、构建期 head 预渲染
├── wrangler.toml           # Cloudflare Wrangler 配置文件
├── package.json
└── vite.config.ts
```

---

## 🚀 本地开发指南

### 1. 安装依赖
```bash
npm install
```

### 2. 启动前端 Vite 开发服务器
```bash
npm run dev
```
打开浏览器访问：`http://localhost:5173` 即可立即进入体验！

### 3. 本地全栈开发（前后端分离）
开发期前后端各跑一个进程，浏览器**只访问 Vite**：

```bash
# 终端 A：初始化本地 SQLite 数据库（只需一次；之后表结构变更用 db:migrate:local 增量升级）
npm run db:migrate:local

# 终端 B：只提供 API 的 Cloudflare Pages Functions 服务
npm run cf:dev            # → http://127.0.0.1:8787

# 终端 C：前端热更新
npm run dev               # → http://localhost:5173
```

- 前端页面：`http://localhost:5173`（HMR 生效）
- API 服务：`http://127.0.0.1:8787`，**不提供前端页面**；`vite.config.ts` 把 `/api` 代理过去
- 直接访问 8787 的 `/` 会看到一个「这里只提供 API」的提示页

> 这是开发场景。想验证线上行为（`dist/` 构建产物 + `_redirects` SPA 回退 + 同域部署），
> 用 `npm run preview` 或部署到 Cloudflare Pages，不要依赖 `cf:dev`。

> `wrangler.toml` 的 `[vars]` 里带了一个**仅用于本地开发**的 `JWT_SECRET`，服务端在密钥缺失时
> 会直接返回 `50003` 而不会回退默认值。
>
> 开源仓库或生产部署请改用 Secret，并删除 `[vars]` 中的明文值：
>
> ```bash
> npx wrangler secret put JWT_SECRET
> ```
>
> 本地想换一套密钥时，创建 `.dev.vars`（已被 git 忽略）写入 `JWT_SECRET=...` 即可，
> 它会覆盖 `wrangler.toml` 中的值。模板见 `.dev.vars.example`。
>
> **跨域**：`/api` 只放行 `APP_ORIGIN` 里列出的来源（逗号分隔），未配置时不放行任何跨域来源。
> 本地 Vite（5173）代理到 8787 时属于服务端到服务端转发，不需要额外配置；
> 只有在浏览器里直接请求 8787 时才需要 `APP_ORIGIN=http://localhost:5173`。

### 4. 生产打包
```bash
npm run build
```

---

## ☁️ 部署到 Cloudflare

1. 将代码推送到 GitHub / GitLab 仓库。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages** -> **Create application** -> **Pages**。
3. 连接 GitHub 仓库并配置构建命令：
   - **Framework preset**: `Vue`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 在 Pages 项目的 **Settings** -> **Functions** 中绑定：
   - **D1 database bindings**: 变量名 `DB` 绑定您的 D1 实例。
   - **R2 bucket bindings**: 变量名 `BUCKET` 绑定您的 R2 存储桶。
5. 在 **Settings** -> **Environment variables** 中确认 `JWT_SECRET` 已作为 Secret 注入
   （不要依赖 `wrangler.toml` 里的明文值）。
6. 数据库结构变更通过迁移增量升级，不要直接重跑 `schema.sql`：

   ```bash
   npm run db:migrate:remote
   ```

7. 配置每日清理（可选但建议）：注销冷静期到期的账号、180 天前的访问记录、过期的限流计数都由同一个脚本回收。
   登录时的惰性删除只能覆盖「注销后又回来登录」的人，**注销后不再回来的账号必须靠定时任务**。
   可在 Cloudflare Cron Trigger 里每天跑一次：

   ```bash
   npm run db:purge:remote -- --dry-run   # 先看会删什么
   npm run db:purge:remote                # 真正执行
   ```

8. 部署完成后即可获得全球 Anycast 加速的完全免费个人简历平台！
