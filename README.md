# OpenResume 极简开源简历制作平台

> 一款基于 **Vue 3** 构建、前后端完全托管于 **Cloudflare 免费生态**（Pages + Workers/Functions + D1 + R2）的现代化所见即所得简历制作平台。

---

## 🌟 核心特性

- 📄 **真实 A4 实时排版**：左侧结构化表单录入，右侧 1:1 标准 A4 比例画布即时渲染，支持动态跨页标线提示。
- 🪄 **一页纸自适应神器**：内置模块与段落垂直间距微调滑块，经历较少可一键饱满填满，经历较多可一键紧缩防超页。
- 🖨️ **无水印高清矢量导出**：告别竞品导出收费与低清模糊截屏，基于现代浏览器原生 `@media print` 打印引擎，文字可选中、超链接可跳转、文件体积极小。
- 🎨 **数据与视图彻底解耦**：内置 3 套经典热门排版模板（经典商务型、极简极客型、现代双栏型），切换模板 100% 保持个人经历数据完整。
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
│   ├── PRD.md              # 产品需求文档
│   ├── REQUIREMENTS.md     # 详细功能规格说明书 (对标竞品细节)
│   ├── API.md              # RESTful 接口与 TypeScript 共享契约
│   └── schema.sql          # Cloudflare D1 数据库初始化 SQL
├── functions/              # Cloudflare Pages Functions 后端 API (Hono)
│   ├── api/
│   │   └── [[route]].ts    # 统一 RESTful API 路由实现 (Auth, Resumes, R2 Upload)
│   └── types.ts            # D1、R2 环境变量绑定定义
├── src/                    # 前端 Vue 3 核心应用
│   ├── assets/             # Tailwind 与打印 @media print 样式
│   ├── components/         # 导航栏、模板切换弹窗等通用组件
│   ├── modules/editor/     # 编辑器核心组件 (FormPanel, PreviewCanvas, StyleDrawer...)
│   ├── templates/          # 3 套精美模板 (Classic, Geek, Modern)
│   ├── stores/             # Pinia 状态管理 (resume 状态机, auth)
│   ├── types/              # 前端 TypeScript 契约
│   ├── utils/              # 矢量打印驱动器、默认示范范文
│   └── views/              # 首页、工作台、编辑器、只读分享页
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

### 3. 本地全栈开发与 Cloudflare 模拟器 (可选)
如果需要联调 D1 数据库和后端 API：
```bash
# 初始化本地 SQLite 数据库
npm run d1:init:local

# 启动 Cloudflare Pages 本地全栈模拟器
npm run cf:dev
```

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
5. 部署完成后即可获得全球 Anycast 加速的完全免费个人简历平台！
