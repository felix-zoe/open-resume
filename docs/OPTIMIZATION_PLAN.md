# OpenResume 优化与扩展方案（v2.0）

| 文档编号 | 版本 | 编写日期 | 状态 | 适用范围 |
| :--- | :--- | :--- | :--- | :--- |
| PLAN-2026-OR-002 | v1.0 | 2026-10-17 | 待评审 | 前端页面、编辑器引擎、后端接口、产品功能与后续路线图 |

> **阅读指南**
> - 第 0 章给出结论与优先级，时间紧可只读此章。
> - 第 1 章解决“页面怎么优化、风格统一成什么样”。
> - 第 2 章逐项列出已有功能的问题、证据（`文件:行号`）与修改方式。
> - 第 3 章给出“建议下线/降级”的功能清单及迁移方式。
> - 第 4 章给出扩展功能与闭环设计。
> - 第 5 章是可执行的 Sprint 计划、文件级改动清单、验收指标与风险。
> - 全文使用统一问题编号：`UX-*` 体验、`FUNC-*` 功能、`RENDER-*` 排版渲染、`DATA-*` 数据、`SEC-*` 安全、`PERF-*` 性能、`EXP-*` 扩展。

---

## 0. 执行摘要

### 0.1 一句话判断

当前项目**骨架完整、方向正确，但处于“功能演示态”而非“可交付产品态”**：核心编辑链路存在多处数据丢失级缺陷，排版引擎的测量基准错误导致分页提示与一键卡页失真，设计系统缺失导致页面风格割裂，若干功能（ATS 评分、HR 足迹、云端导出）实现不成熟却以完成品口径对外呈现。

### 0.2 必须先修的 12 个问题（S0/S1）

| # | 编号 | 问题 | 影响 | 证据 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | FUNC-01 | `/editor/demo` 每次进入都执行 `resetToPreset()`，游客编辑内容被清空 | 游客草稿必丢，直接破坏“免登录即用”卖点 | `src/views/EditorView.vue:33-37` |
| 2 | FUNC-02 | 分享按钮对 `demo` 也生成 `/share/demo`，该页渲染的是内置示例而非用户编辑内容 | 用户把“别人的简历”发给 HR | `src/modules/editor/EditorHeader.vue:46-53`、`src/views/ShareView.vue:69-95` |
| 3 | FUNC-03 | 登录/注册成功后仅改了 `resumeStore.id`，URL 仍是 `/editor/demo`；刷新后再次被重置 | 登录后刷新即丢数据 | `src/components/AuthModal.vue:105-127`、`src/views/LoginView.vue:113-135` |
| 4 | SEC-01 | 模板中 `:href` 直接绑定用户输入，未校验协议，`javascript:` 可在分享页执行 | 公开分享页存储型 XSS | `src/templates/ClassicTemplate.vue:60-65,116`、`GeekTemplate.vue:55-60`、`ModernTemplate.vue:79-86` |
| 5 | SEC-02 | `JWT_SECRET` 缺省回退到硬编码字符串 | 生产环境可伪造任意用户 Token | `functions/api/[[route]].ts:90,121,166` |
| 6 | FUNC-04 | `exportPdf.ts` 请求 `/api/export-pdf` 时未带 `Authorization`，而接口强制登录 | 云端一键导出 100% 返回 401，永远走打印弹窗 | `src/utils/exportPdf.ts:126-130`、`functions/api/[[route]].ts:593-597` |
| 7 | FUNC-05 | 云端导出会移除 `<base>`，但头像仍为相对路径 `/api/file/...`，`setContent` 下解析为 `about:blank` | 云端 PDF 头像丢失 | `functions/api/[[route]].ts:609,630` |
| 8 | RENDER-01 | 分页测量读取的是带 `min-height:297mm` 的外层纸，`scrollHeight` 恒 ≥1122，而阈值为 1115 | **任何简历都显示“第 1 页截断线”且页数恒为 2** | `src/modules/editor/PreviewCanvas.vue:13,29-44,109` |
| 9 | RENDER-02 | 模板正文大量使用 `text-xs` 等固定 rem 字号，`theme.fontSize` 仅作用于根节点 | “正文字号”滑块基本无效 | `src/templates/ClassicTemplate.vue:84-170`、`src/modules/editor/StyleDrawer.vue:138-153` |
| 10 | RENDER-03 | Modern 模板内层自带 `min-height:297mm`，AutoFit 测量 `scrollHeight` 恒为整页 | Modern 模板一键单页永远判定“超页”并压缩 | `src/templates/ModernTemplate.vue:15-19,39`、`src/stores/resume.ts:174` |
| 11 | RENDER-04 | 打印/导出为单个连续 `.a4-print-target`，分页后第 2 页起没有上边距 | 两页简历第二页贴顶、观感崩坏 | `src/assets/main.css:74-87`、`src/utils/exportPdf.ts:103-117` |
| 12 | UX-01 | 大量使用 `shadow-2xs / shadow-xs / rounded-xs / backdrop-blur-2xs / py-4.5` 等 Tailwind v3.4 不存在的类 | 预期的阴影、圆角、模糊全部静默失效 | `tailwind.config.js`、全项目 34 处 |

### 0.3 五个结构性结论

1. **游客链路是断裂的**：入口、草稿、登录迁移、分享四个环节各自为政，用户第一次使用就会遇到“内容消失”或“分享错内容”。
2. **排版引擎缺少统一的“测量层”**：分页、AutoFit、页数、打印各自读不同的 DOM，基准不一致，导致提示与真实输出互相矛盾。这是当前最大的技术债。
3. **模板是三份复制粘贴**：三套模板各自实现模块渲染，导致 `modulesOrder`、`showBorder`、模块标题、字号主题在不同模板下行为不一致。
4. **设计系统不存在**：`gray` 与 `slate` 混用（249 : 293）、蓝色/靛蓝/紫罗兰三种强调色并存、字号 10/11/12/13/14px 随意出现、19 处原生 `alert/confirm`。
5. **“高级功能”先于基础质量**：ATS 评分、HR 足迹、版本历史、云端 PDF 都在核心保存/分享链路尚未稳定时上线，且多数为半成品，反而稀释了“免费、无水印、专业排版”的主卖点。

### 0.4 建议的产品节奏

> **先做“可信”，再做“聪明”。**
> v2.0 的目标不是增加功能，而是让现有功能达到“敢让 HR 用”的质量线；v2.1 起再扩展内容助手、投递管理、英文简历与 AI。

---

## 1. 前端页面优化与视觉统一

### 1.1 设计定位

| 维度 | 结论 |
| :--- | :--- |
| **关键词** | 专业、克制、可信、纸感 |
| **气质** | 工具型产品，不做“营销落地页式的浮夸”；让简历本身成为视觉主角 |
| **参考对象** | Linear / Notion 的信息层级 + 超级简历的编辑效率 + 传统排版软件的“纸面感” |
| **明确不做** | 大面积渐变、发光球、玻璃拟态堆叠、无意义动效、10px 以下正文 |

### 1.2 两套视觉域（当前最大问题的根因）

必须把“产品外壳”和“简历文档”彻底分开，分别定义样式规则，禁止互相污染：

| 视觉域 | 范围 | 色彩 | 字体 | 尺寸单位 | 阴影/圆角 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App Chrome（产品外壳）** | 首页、登录、工作台、编辑器工具栏、抽屉、弹窗 | 中性 `slate` + 单一主色 `primary` | 系统无衬线 | px / rem | 允许轻阴影与 8–16px 圆角 |
| **Resume Document（简历文档）** | 三套模板、分享页纸张、PDF | 白底 + 黑灰文字 + 一个主题强调色 | 由 `theme.fontFamily` 决定 | **mm / em** | 无阴影、无圆角、无交互态 |

**硬性约束**：简历模板内禁止使用 Tailwind 的 `text-xs/text-sm` 等固定字号类，改为 `em` 相对单位；禁止 emoji 作为图标；禁止 `hover:` 等仅屏幕可见的样式。

### 1.3 设计令牌（Design Tokens）

#### 1.3.1 Tailwind 配置改造

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 唯一主色，替换现有 blue/indigo 混用
        primary: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a'
        },
        // 语义色只用于状态，不用于装饰
        success: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669', 700: '#047857' },
        warning: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        danger:  { 50: '#fff1f2', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        serif: ['"Songti SC"', 'SimSun', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      fontSize: {
        '2xs': ['11px', '16px'],   // 仅用于元信息，禁止再出现 text-[10px]
        'xs':  ['12px', '18px'],
        'sm':  ['13px', '20px'],
        'base':['14px', '22px'],
        'lg':  ['16px', '24px'],
        'xl':  ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['30px', '38px']
      },
      borderRadius: {
        xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '20px'
      },
      boxShadow: {
        // 只保留 4 档，且全部使用低透明度 slate
        xs: '0 1px 2px rgba(15,23,42,.06)',
        sm: '0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04)',
        md: '0 4px 12px rgba(15,23,42,.08)',
        lg: '0 12px 32px rgba(15,23,42,.12)'
      },
      transitionDuration: { DEFAULT: '160ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)' }
    }
  },
  plugins: []
};
```

#### 1.3.2 全局 CSS 变量

```css
/* src/assets/main.css */
:root {
  --app-bg: #f8fafc;
  --panel-bg: #ffffff;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
  --focus-ring: 0 0 0 3px rgba(37, 99, 235, .18);
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-modal: 16px;
}
```

#### 1.3.3 类名迁移规则（可脚本化）

| 旧写法 | 新写法 | 说明 |
| :--- | :--- | :--- |
| `bg-gray-50/100` | `bg-slate-50/100` | 统一中性色 |
| `text-gray-*` / `border-gray-*` | `text-slate-*` / `border-slate-*` | 同上 |
| `bg-blue-600` / `from-blue-600 to-indigo-600` | `bg-primary-600` / `bg-primary-600` | 取消渐变按钮，保留单一主色 |
| `text-indigo-*` / `text-purple-*` | `text-primary-*` | 强调色收敛 |
| `shadow-2xs` | `shadow-xs` | v3.4 无 `2xs` |
| `shadow-xs`（原意） | `shadow-sm` | 重命名后重新映射 |
| `rounded-xs` | `rounded-sm` | v3.4 无 `xs` |
| `backdrop-blur-2xs` | `backdrop-blur-sm` | v3.4 无 `2xs` |
| `py-4.5` | `py-[18px]` | 非默认间距 |
| `text-[10px]` | `text-2xs`（11px） | 可读性下限 |
| `text-[11px]` | `text-2xs` 或 `text-xs` | 按语义选择 |
| `animate-pulse`（装饰球） | 删除 | 干扰注意力 |

### 1.4 统一组件库（`src/components/ui/`）

当前所有页面各自手写按钮/输入框/弹窗，导致圆角、边框、焦点态、禁用态各不相同。建立一层轻量组件，**不引入第三方 UI 框架**，保持包体可控。

| 组件 | 关键 Props / API | 替代的现状 |
| :--- | :--- | :--- |
| `AppButton` | `variant: primary \| secondary \| ghost \| danger \| outline`；`size: sm \| md \| lg`；`loading`；`disabled`；`block`；`icon` 插槽 | 各页面手写 `bg-blue-600 px-4 py-2.5 rounded-xl ...` |
| `AppInput` / `AppTextarea` | `v-model`；`label`；`hint`；`error`；`required`；`prefixIcon`；`maxlength`；`showCount` | 表单区重复的 label + input 结构 |
| `AppSelect` | 原生 `select` 封装，统一箭头与焦点态 | 教育模块的裸 `select` |
| `AppSwitch` | `v-model`；`label`；`description` | 显隐开关、公开分享开关 |
| `AppCheckbox` | `v-model`；`label` | 显示头像、记住我 |
| `AppModal` | `v-model:open`；`title`；`size`；`closeOnEsc`；`closeOnOverlay`；焦点陷阱；滚动锁 | AuthModal / AtsModal / TemplateModal 三套实现 |
| `AppDrawer` | `side: right \| left`；`v-model:open` | StyleDrawer |
| `AppToast` + `useToast()` | `toast.success/error/info(message, { duration })`；队列；顶部居中 | 19 处 `alert()` |
| `AppConfirm` + `useConfirm()` | `confirm({ title, description, danger }) => Promise<boolean>` | `confirm()` 与删除确认 |
| `AppTabs` | `v-model`；`items` | 登录/注册 Tab、移动端编辑/预览 Tab |
| `AppBadge` | `variant`；`size` | 模板标签、“已保存”状态 |
| `AppCard` | `padding`；`hoverable` | 工作台卡片、模块卡片 |
| `AppEmpty` | `icon`；`title`；`description`；`action` 插槽 | 工作台空态、统计空态 |
| `AppSkeleton` | `lines`；`avatar` | 加载态 |
| `FormField` | `label` / `hint` / `error` 布局容器 | 各 Section 重复的 label 样式 |
| `AppMenu` | 触发器 + 下拉项 + 键盘导航 | Navbar 用户菜单 |

**统一交互规范**：

- 焦点：所有可交互元素必须有 `focus-visible:ring-2 ring-primary-500/40 ring-offset-1`。
- 禁用：`opacity-50 cursor-not-allowed`，禁止仅靠颜色区分。
- 加载：按钮内旋转图标 + 文案切换（“保存中…”），禁止只换图标。
- 危险操作：红色 `danger` 变体 + 二次确认；删除简历需输入标题或明确勾选。
- Toast 位置：顶部居中，3 秒自动消失；错误 Toast 5 秒且可手动关闭。
- 弹窗：`Esc` 关闭、点击遮罩关闭（危险确认除外）、打开时锁定 body 滚动、关闭后焦点回到触发元素。

### 1.5 页面逐页改造

#### 1.5.1 全局壳层（Navbar / 页脚）

**现状问题**

- Navbar 与编辑器 Header 是两套品牌样式（渐变 Logo vs 纯色 Logo）。
- 编辑器页没有“返回工作台”入口，只有回首页（`EditorHeader.vue:89`）。
- 页脚仅首页存在，工作台/登录页无统一页脚。
- 登录后“新建一份简历”跳到 `/editor/demo`，同样触发 FUNC-01。

**改造方案**

1. 抽出 `AppHeader`（营销页）与 `EditorHeader`（编辑器）两套，但共享 `BrandLogo`、`UserMenu`、`AppButton`。
2. 编辑器 Header 左侧改为“返回工作台（登录）/ 返回首页（游客）”，中间标题，右侧保存状态。
3. 统一页脚组件：产品链接（模板、示例、帮助）、法律链接（隐私、条款）、开源地址。
4. 移动端 Header 只保留 Logo、保存状态、导出按钮，其余收进“更多”菜单。

**验收**：任意页面 Logo 尺寸、颜色、圆角一致；编辑器可一键回到工作台；移动端 Header 不换行、不溢出。

#### 1.5.2 首页（`HomeView.vue`）

**现状问题**

| 问题 | 说明 |
| :--- | :--- |
| 营销信息过载 | Hero + 模板 + 对比表 + 特性 + FAQ + CTA 共 6 段，首屏到 CTA 的路径过长 |
| 不可验证的绝对化表述 | “对标一线大厂高通过率”“独家算法”“通过率极高”“端到端加密”等，存在信任与广告合规风险 |
| 模板展示是抽象骨架 | 用户看不到真实成品，转化弱 |
| 产品截图是 CSS 画的假界面 | 与真实编辑器差距大，容易产生“货不对板”感 |
| 对比表贬低竞品 | “竞品套路”“收费限制”等措辞，法律与品牌风险高 |
| 无真实示例 | 没有“前端/产品/应届”等岗位样例，SEO 与转化都弱 |

**改造方案**

1. **首屏**：一句价值主张 + 一个真实可交互的简历缩略预览（直接复用 `ClassicTemplate` 缩放渲染）+ 两个 CTA（“开始制作”“查看模板”）。删除发光球与 `animate-pulse`。
2. **三步流程**：`填写内容 → 实时预览 → 免费导出`，每步配真实截图。
3. **模板区**：用真实模板组件渲染 3 张缩略图（`transform: scale(0.35)` + `pointer-events:none`），标注适用行业、是否 ATS 友好、是否含照片。
4. **示例区**：新增 6 个岗位示例（前端、后端、产品、运营、应届、转行），点击“以此为例新建”。
5. **对比区改为“能力清单”**：只陈述自己能做什么（无水印、矢量 PDF、本地优先、开源），不逐条贬低竞品。
6. **FAQ 保留 4 条**，答案改为可验证事实；删除“通过率”类承诺。
7. **底部 CTA** 保留一个，删除重复的第二个 CTA 区。

**验收**：首屏 LCP ≤ 1.8s（国内网络实测）；首屏包含真实简历预览；全页无“独家/最高/通过率”等绝对化用语；移动端首屏不出现横向滚动。

#### 1.5.3 登录 / 注册（`LoginView.vue`、`AuthModal.vue`）

**现状问题**

| 问题 | 说明 |
| :--- | :--- |
| 同一套逻辑两份实现 | `LoginView` 与 `AuthModal` 约 90% 重复，改一处漏一处 |
| 虚假安全表述 | “端到端加密”“D1 边缘加密”不属实（服务端可读 JSON） |
| “忘记密码”只弹 alert | 无实际能力，破坏信任 |
| “保持登录状态”未生效 | `rememberMe` 未参与任何逻辑 |
| 登录后不跳转编辑器 | 仅在当前页改 store id，URL 不同步 |
| 无协议勾选 | 底部一句“登录即代表同意”，无链接 |
| 无错误码细分 | 40103 与网络错误都显示同一句 |

**改造方案**

1. 只保留 `AuthModal` 一套表单组件，`LoginView` 作为其全屏布局容器复用；删除重复逻辑。
2. 删除“端到端加密”，改为“密码经 PBKDF2 加盐哈希存储；简历数据仅你本人可访问”。
3. “忘记密码”在能力上线前**移除链接**；上线后走邮件重置（见 4.3.10）。
4. 删除“保持登录状态”复选框，或真正实现“7 天 / 关闭浏览器失效”两种 Token 策略。
5. 登录成功后：若存在本地草稿 → 弹出“同步到云端 / 仅保留本地”选择；同步成功 → `router.replace('/editor/<newId>')`。
6. 增加协议与隐私链接，注册按钮下方明确勾选。
7. 统一错误映射：`40001/40002/40103/429` 分别给出可操作文案。

**验收**：登录后刷新不丢内容；忘记密码不再出现无效入口；两个入口的视觉与文案完全一致。

#### 1.5.4 工作台（`DashboardView.vue`）

**现状问题**

| 问题 | 说明 |
| :--- | :--- |
| 硬编码 demo 卡片 | 登录用户也会看到“张小凡”示例卡，删除仅本地 splice |
| 新建只有一种方式 | 永远创建“经典模板 + 张小凡示例数据”，无空白/模板选择 |
| 无重命名 | 文档承诺但未实现 |
| N+1 统计请求 | 每份简历单独请求一次 analytics（`DashboardView.vue:162-175`） |
| 无搜索/排序/分组 | 简历一多就无法管理 |
| 卡片信息弱 | 无缩略图、无完成度、无公开状态说明 |
| 全部使用 `alert/confirm` | 体验割裂 |
| 无空态 | 新用户看到一张 demo 卡，不知道下一步 |

**改造方案**

1. **删除 demo 卡片**；游客访问工作台直接引导登录或进入本地草稿。
2. **新建流程**改为弹窗三步：选择模板（真实缩略图）→ 选择起点（空白 / 示例数据 / 从已有复制）→ 命名。
3. 卡片增加：真实缩略图、模板名、更新时间、公开状态、完成度进度条（必填字段 + 内容量）、更多菜单（重命名/复制/分享/删除/导出）。
4. 顶部增加：搜索框、排序（最近编辑/创建时间/名称）、视图切换（网格/列表）。
5. 统计改为后端聚合接口 `GET /api/resumes/stats`，一次返回所有简历的浏览/下载汇总。
6. 空态：插画 + “创建第一份简历” + “从示例开始”。
7. 所有 `alert/confirm` 替换为 `useToast` / `useConfirm`。

**验收**：新建 3 份简历后列表无重复请求；重命名即时生效；删除有明确二次确认；空态有明确行动按钮。

#### 1.5.5 编辑器（`EditorView.vue` + `modules/editor/*`）

**现状问题**

| 问题 | 说明 |
| :--- | :--- |
| 移动端不可用 | `FormPanel` 在小屏 `w-full`，`PreviewCanvas` 仍 `flex-1`，两者被挤在同一行（`FormPanel.vue:73`、`EditorView.vue:88`） |
| 无撤销/重做 | 误删经历无法恢复 |
| 无未保存离开提醒 | 2.5s 防抖窗口内关闭页面即丢 |
| 缩放容器不占位 | `transform: scale()` 不影响布局，150% 时底部被裁、50% 时大量留白（`PreviewCanvas.vue:76-79`） |
| 模块排序是上下箭头 | 排序时表单本身跳动，且不是拖拽 |
| 字号滑块无效 | 见 RENDER-02 |
| 分页提示恒为 2 页 | 见 RENDER-01 |
| 保存状态不可点击 | 失败后无重试入口 |
| 日期是自由文本 | `2022.7` / `2022.07` / `2022-07` 混用，导出不统一 |
| 无字段校验 | 空姓名也能导出 |
| 技能/自定义条目用 index 作 key | 删除中间项时输入焦点与值可能错位 |
| 头像无裁剪/压缩/删除 | 2MB 原图直接上传或转 base64 |

**改造方案**

1. **响应式三态**：
   - `≥1280px`：左表单 480px + 右预览自适应。
   - `1024–1279px`：左表单 420px + 右预览，工具栏折叠为图标。
   - `<1024px`：单栏 + 顶部 Tab（内容 / 预览 / 样式），底部固定“导出”按钮；预览默认“适应宽度”。
2. **缩放修复**：改用 CSS `zoom`（Chrome/Safari/Firefox 126+ 均支持且参与布局），或对 `transform` 容器补偿 `width/height`（`scale` 后设置 `margin-bottom` 与占位高度）。推荐 `zoom`，实现简单且滚动正确。
3. **撤销/重做**：`useUndoRedo` 组合式函数，监听 `content/themeConfig/title/templateId`，500ms 合并快照，栈上限 50；`Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`；云端加载时清空栈。
4. **离开保护**：编辑器内监听 `beforeunload`，`saveStatus !== 'saved'` 时提示；同时提供 `Ctrl/Cmd+S` 手动保存。
5. **模块管理**：新增“模块管理”抽屉，列表项可拖拽（HTML5 DnD 或轻量 `sortablejs`），带眼睛开关；表单区只保留折叠，不再承担排序。
6. **字段组件化**：
   - 日期统一为 `MonthPicker`（年 + 月）+ “至今”开关，存储格式固定 `YYYY.MM`。
   - 手机号、邮箱、URL 增加即时校验与错误文案。
   - 每条经历增加“复制此条”“上移/下移/删除”与折叠。
7. **头像**：选图后进入裁剪弹窗（1:1），Canvas 压缩为 WebP 300×300、质量 0.85，目标 ≤80KB；提供“移除头像”。
8. **保存状态**：点击状态徽标可查看“上次保存时间 / 重试 / 查看冲突”；失败自动指数退避重试（2s/5s/15s），恢复网络后自动重试。
9. **空内容引导**：新建空白简历时，各模块显示示例占位与“插入示例”按钮，而不是直接塞入张小凡数据。

**验收**：iPhone SE 宽度下可完成“填写 → 预览 → 导出”全流程；150% 缩放可滚动到页面底部；误删后 `Ctrl+Z` 可恢复；断网 10 秒后恢复网络能自动补存。

#### 1.5.6 分享页（`ShareView.vue`）

**现状问题**

| 问题 | 说明 |
| :--- | :--- |
| 无社交预览 | 没有 `og:title/description/image`，微信/LinkedIn 分享是空白卡片 |
| 无二维码 | 线下/打印场景无法扫码 |
| 联系方式默认全量暴露 | 公开链接直接展示手机号、邮箱、期望薪资 |
| 无有效期/密码/撤销 | 只能整份公开或私有 |
| 下载按钮依赖登录 | 游客点击后静默降级为打印弹窗 |
| 页脚无品牌信息 | 只有顶部一条 |
| 访问统计重复上报 | 下载时 `reportVisit(true)` 未置 `hasReported`，离开页面再报一次（`ShareView.vue:45-54,98-111`） |

**改造方案**

1. **分享弹窗**（编辑器与工作台共用）：公开开关、复制链接、二维码、有效期（7/30 天/永久）、密码（可选）、隐藏联系方式开关、“允许下载 PDF”开关。
2. **OG 预览**：用 Pages Function 在 `/share/:id` 返回时注入 `<title>`、`description`、`og:image`（先使用静态品牌图，后续可生成缩略图并缓存到 R2）。
3. **隐私默认值**：公开链接默认隐藏手机号/邮箱后四位（可在弹窗中关闭）。
4. **下载**：游客点击“下载 PDF”时，优先本地打印（无需登录），文案明确“将打开打印对话框，选择‘另存为 PDF’”；登录用户才展示“云端高清下载”。
5. **页脚**：增加“由 OpenResume 免费制作”小标识（可关闭，用于传播）。
6. **统计修复**：下载后立即置 `hasReported = true`；`pagehide` 替代 `beforeunload`（移动端更可靠）。

**验收**：分享链接在微信中显示标题与描述；默认不暴露完整手机号；下载不再出现“正在生成”后无反应。

#### 1.5.7 空态 / 加载态 / 错误态

当前只有 ShareView 有“简历不存在”页，其余页面加载失败时静默展示默认数据。统一规范：

| 状态 | 规范 |
| :--- | :--- |
| 加载 | 骨架屏（卡片/表单/预览），禁止全屏 spinner 超过 300ms |
| 空 | 图标 + 一句说明 + 主行动按钮 |
| 错误 | 明确原因 + 重试按钮 + 返回入口；网络错误与权限错误区分 |
| 404 | 独立页面，提供“回首页 / 打开我的简历” |
| 401 | 清除登录态 + Toast“登录已过期” + 跳转登录并带 `redirect` |
| 403 | “无权访问该简历”，不泄露是否存在 |

新增 `src/views/NotFoundView.vue` 与 `src/components/AppErrorState.vue`。

### 1.6 响应式策略

| 断点 | 首页 | 工作台 | 编辑器 | 分享页 |
| :--- | :--- | :--- | :--- | :--- |
| `<640px` | 单列，Hero 标题 28px | 单列卡片 | Tab 切换，预览适应宽度 | 纸张 `scale` 适应宽度，顶部操作条精简 |
| `640–1023px` | 2 列模板 | 2 列 | Tab 切换 | 同上 |
| `1024–1279px` | 3 列 | 3 列 | 左 420px + 右预览 | 纸张 100% |
| `≥1280px` | 3 列 | 3 列 | 左 480px + 右预览 | 纸张 100% |

**硬性要求**：所有可点击区域 ≥ 40×40px；表单输入字号 ≥ 16px（避免 iOS 自动放大）；编辑器移动端不出现横向滚动。

### 1.7 可访问性（A11y）

1. 对比度：`text-slate-400` 在白底对比度约 2.6:1，不满足 WCAG AA；正文元信息改用 `slate-500`（约 4.8:1）或 `slate-600`。
2. 所有图标按钮补 `aria-label`；纯图标按钮必须有 `title`。
3. 弹窗/抽屉：焦点陷阱、`aria-modal="true"`、`Esc` 关闭、关闭后焦点归还。
4. 表单：`label` 与 `input` 用 `for/id` 关联；错误用 `aria-describedby`。
5. 键盘：编辑器支持 `Tab` 遍历、`Ctrl/Cmd+S` 保存、`Ctrl/Cmd+Z` 撤销。
6. 动效：`@media (prefers-reduced-motion: reduce)` 下关闭位移与缩放动画。
7. 语义：每页唯一 `h1`；编辑器预览纸张用 `role="document"`。

### 1.8 文案与信任

| 位置 | 现状 | 建议 |
| :--- | :--- | :--- |
| 首页 Hero | “独家”“高通过率” | “本地优先、无水印、矢量 PDF” |
| 首页对比表 | “竞品套路”“收费限制” | 删除，改为能力清单 |
| 登录页 | “端到端加密” | “PBKDF2 加盐哈希；仅你本人可访问” |
| ATS 弹窗 | “ATS 评分”“免费尊享” | “JD 关键词对照”“本地分析，不上传” |
| 工作台 | “HR 阅读足迹” | “在线访问统计” |
| 导出 Toast | “云端引擎就绪中” | 明确“已打开打印对话框”或“云端生成失败，已切换本地打印” |

### 1.9 视觉验收清单

- [ ] 全项目 `gray-*` 归零，统一 `slate-*`。
- [ ] 全项目 `indigo-*` / `purple-*` 仅作为语义色或删除。
- [ ] `shadow-2xs` / `rounded-xs` / `backdrop-blur-2xs` / `py-4.5` 归零。
- [ ] 按钮只有 5 种 variant、3 种尺寸；不存在页面级自定义按钮样式。
- [ ] 正文 UI 字号 ≥ 12px，元信息 ≥ 11px，无 10px。
- [ ] 所有弹窗可用 `Esc` 关闭，焦点不逃逸。
- [ ] 所有异步操作有 loading / success / error 三态。
- [ ] 移动端 375px 宽度下无横向滚动。
- [ ] 三套模板在 3 种主题色、2 种字号下的截图通过人工评审。

---

## 2. 现有功能问题与优化

### 2.1 功能成熟度矩阵

| 模块 | 现状 | 完成度 | 评级 | 处置 |
| :--- | :--- | :--- | :--- | :--- |
| 注册/登录/JWT | 可用，但无重置、无频控、有默认密钥 | 70% | C | 补强 |
| 游客本地草稿 | 入口会重置，无独立草稿列表 | 30% | D | 重做 |
| 工作台列表 | 增删改查基本可用，含 demo 卡与 N+1 | 65% | C | 重构 |
| 编辑器表单 | 5 个模块，字段基本齐全 | 80% | B- | 增强 |
| 模块排序 | 仅上下箭头 | 50% | C | 改为拖拽 + 管理抽屉 |
| 模板系统 | 3 套，但各自为政 | 55% | C | 重构 |
| 主题样式 | 7 个参数，字号失效 | 50% | C | 变量化 + 修复 |
| A4 预览 | 单页 + 断线，断线恒显示 | 50% | D | 真分页 |
| 一键单页 | 单次调整，Modern 必失效 | 35% | D | 重写 |
| PDF 导出 | 云端 401、打印多页无页边距 | 50% | C | 修复 + 主次调整 |
| ATS/JD 诊断 | 启发式评分，关键词噪声大 | 40% | D | 降级为关键词对照 |
| 访问统计 | 可被伪造、含本人访问、N+1 | 35% | D | 改名 + 去伪 |
| 版本历史 | 仅后端写入，无 UI | 20% | D | 补 UI 或停写 |
| 头像上传 | 无裁剪/压缩/删除，无清理 | 45% | C | 重做 |
| 分享页 | 可读，但无 OG/二维码/隐私控制 | 50% | C | 增强 |
| 移动端 | 编辑器不可用 | 20% | D | 重做 |
| 测试与 CI | 1 个 87 行脚本 | 10% | D | 建立 |

### 2.2 数据保存与账号链路（P0）

#### DATA-01 游客草稿被重置

- **现象**：访问 `/editor/demo` 时 `resetToPreset()` 无条件执行，覆盖本地已有内容。
- **证据**：`src/views/EditorView.vue:33-37`。
- **修复**：
  1. `demo` 只用于“首次演示”，进入前先尝试 `loadLocalDraft('demo')`；有草稿则恢复，无草稿才注入示例。
  2. 新增 `/editor/new` 作为真正的“开始制作”入口，生成 `local_<uuid>` 草稿；首页 CTA 全部指向它。
  3. `demo` 路由加 `?fresh=1` 才强制重置，普通访问不重置。
- **验收**：游客编辑 → 返回首页 → 再次进入，内容仍在。

#### DATA-02 登录迁移不同步 URL

- **现象**：`AuthModal` 创建云端简历后仅 `resumeStore.id = newId`，路由仍是 `/editor/demo`；刷新后回到 demo 并重置。
- **证据**：`src/components/AuthModal.vue:105-127`、`src/views/LoginView.vue:113-135`。
- **修复**：迁移成功后 `router.replace({ name: 'Editor', params: { id: newId } })`，并清空旧 demo 草稿（或标记为已迁移）。若迁移失败，保留本地并提示“云端同步失败，草稿已保存在本地”。
- **验收**：登录 → 刷新 → 仍在新简历；工作台能看到该简历。

#### DATA-03 云端加载与自动保存竞态

- **现象**：`loadResumeData` 只暂停自动保存 400ms；若云端请求超过 400ms，用户编辑会触发保存旧内容，随后云端响应又覆盖用户新编辑。
- **证据**：`src/stores/resume.ts:72-90`。
- **修复**：
  1. 暂停状态改为“直到云端请求 resolve/reject”，不要用固定定时器。
  2. 加载期间表单显示骨架或禁用输入。
  3. 若本地草稿 `savedAt` 晚于云端 `updatedAt`，弹出冲突选择（使用本地 / 使用云端 / 合并）。
- **验收**：模拟 3 秒慢网络，编辑不丢失、不被覆盖。

#### DATA-04 localStorage 配额导致云端保存失败

- **现象**：`saveResume` 先写 localStorage，再写云端；base64 头像可能触发 `QuotaExceededError`，异常直接跳到 catch，云端 PUT 不执行。
- **证据**：`src/stores/resume.ts:93-136`。
- **修复**：本地写入用独立 `try/catch`，失败只降级为“仅云端”；游客头像改为压缩后存 IndexedDB，不塞进 localStorage。
- **验收**：上传 2MB 图片后仍能保存到云端。

#### DATA-05 401 无全局处理

- **现象**：Token 过期后所有请求返回 401，前端只显示“保存失败”，不会清理登录态或跳转登录。
- **证据**：`src/router/index.ts:52-59`、`src/stores/resume.ts:126`。
- **修复**：新增 `src/utils/http.ts` 统一封装：
  - 自动附加 `Authorization`；
  - 超时（10s）与 JSON 解析保护；
  - `401` → `authStore.logout()` + Toast + 跳转 `/login?redirect=...`；
  - `403` → 展示无权限页；
  - `5xx` → 可重试错误。
- **验收**：手动删除 Token 后保存，1 次提示并跳转登录，不进入死循环。

#### DATA-06 无离开保护与撤销

- **修复**：见 1.5.5 第 3、4 条。
- **验收**：编辑后 1 秒内关闭标签页出现浏览器确认；误删经历可撤销。

#### DATA-07 保存队列与冲突

- **现象**：2.5s 防抖可能产生并发 PUT；后发请求先到会覆盖新内容。
- **修复**：保存队列串行化（`isSaving` + `pendingSave`），每次保存携带 `clientUpdatedAt`；后端返回 `updatedAt`，前端记录最后确认版本。多标签页用 `BroadcastChannel` 同步 `id + updatedAt`，检测到外部更新时提示刷新。
- **验收**：快速连续编辑 10 次只产生 1–2 次请求，最终内容为最后一次。

### 2.3 排版与预览引擎（P0/P1）

#### RENDER-01 分页测量基准错误

- **根因**：`contentHeight = paperRef.scrollHeight`，而 `paperRef` 是 `.a4-print-target`，其 `min-height: 297mm` 使 `scrollHeight` 永远 ≥ 1122.5；阈值却是 1115。于是：
  - `breakLinePositions` 恒产生 1 条线；
  - 页数 `Math.ceil(1122/1115) = 2`，任何简历都显示“约 2 页”。
- **证据**：`src/modules/editor/PreviewCanvas.vue:13,29-44,109`。
- **修复**：
  1. 测量对象改为模板根节点（`.a4-print-target > .resume-doc`），并移除模板根节点的 `min-height`，由纸张外层负责最小高度。
  2. 常量统一为 `A4_HEIGHT_PX = 1122.52`，断线位置 = `n * 1122.52`。
  3. 页数 = `Math.max(1, Math.ceil(contentHeight / A4_HEIGHT_PX))`。
  4. 断线只在 `contentHeight > 1122.52` 时渲染。
- **验收**：内容不足一页时无断线、显示“1 页”；内容 1.2 页时只在 1122.52 处出现一条线。

#### RENDER-02 字号滑块失效

- **根因**：模板正文使用 `text-xs`（0.75rem = 12px）等固定类，覆盖根节点 `font-size`。
- **证据**：`ClassicTemplate.vue:84-170`、`GeekTemplate.vue:72-151`、`ModernTemplate.vue:90-181`。
- **修复**：模板全面改用 `em`：
  ```css
  .resume-doc { font-size: var(--rs-font-size); line-height: var(--rs-line-height); }
  .rs-name { font-size: 1.72em; }
  .rs-title { font-size: 1.05em; }
  .rs-section-title { font-size: 1em; }
  .rs-body { font-size: 1em; }
  .rs-meta { font-size: .86em; }
  .rs-item-title { font-size: 1em; }
  ```
  模板根节点通过 `style` 注入 `--rs-font-size: ${theme.fontSize}px` 等变量。所有间距同样用 `em`（`margin-bottom: calc(var(--rs-section-gap) * 1px)` 或 `em`）。
- **验收**：拖动字号 12→16px，所有文字（含标题、元信息、技能）等比例变化，排版不溢出。

#### RENDER-03 Modern 模板 AutoFit 失效

- **根因**：Modern 根节点 `min-height: 297mm`，测量高度恒为整页。
- **修复**：移除模板根 `min-height`；AutoFit 测量改为“分页后的总内容高度”（见 RENDER-05）。同时在 AutoFit 前记录当前主题，失败时回滚。
- **验收**：Modern 模板下内容 0.8 页时点“一键单页”会放大间距；1.1 页时会压缩；不会出现“无论怎样都提示超页”。

#### RENDER-04 多页打印无页边距

- **根因**：整个文档是一个连续块，浏览器分页时 `padding-top` 只作用于第一页，`padding-bottom` 只作用于最后一页。
- **证据**：`src/assets/main.css:74-87`、`src/utils/exportPdf.ts:103-117`。
- **修复**：实现真正的分页渲染（RENDER-05），每页是独立的 `.a4-page`，各自带完整 padding，打印时 `break-after: page`。
- **验收**：两页简历导出后，第 2 页顶部留白与第 1 页一致。

#### RENDER-05 真分页引擎（核心重构）

**目标**：预览、打印、云端导出三处使用同一套分页结果，做到“所见即所得”。

**实现方案**

1. **测量容器**：在屏幕外创建 `position: fixed; left: -9999px; width: 210mm` 的容器，渲染与真实模板一致的 DOM。
2. **块收集**：将文档拆为可测量的块序列：
   - `header`（个人信息）
   - 每个模块的 `section-title`
   - 每个经历/项目/教育 `item`
   - 每条 bullet（若单条 item 过高）
3. **贪心装页**：
   ```
   pageContentHeight = 297mm - 2 * pagePadding
   for block in blocks:
     if currentPage.height + block.height <= pageContentHeight:
       currentPage.push(block)
     else:
       if block.height > pageContentHeight:
         split block at line granularity
       newPage()
   ```
4. **渲染**：`pages: Block[][]` → 每页一个 `.a4-page`，内部用 flex column + `gap`（避免 margin 折叠），页间 `break-after: page`。
5. **稳定性**：块使用 `data-block-id` 作为 key，避免输入时 DOM 重建导致光标丢失；编辑区不重新挂载，只重算分页。
6. **性能**：分页计算在 `requestAnimationFrame` 中执行，输入时 150ms 节流；页面数变化时才重建分页 DOM。
7. **边界**：图片加载完成后重算一次（`img.onload`）；字体加载完成后重算一次（`document.fonts.ready`）。

**验收**：
- 预览页数与打印页数一致；
- 任意 item 不被从中间截断（除非单条超过一页）；
- 每页顶部/底部留白一致；
- 3 套模板 × 3 种字号下通过截图对比。

#### RENDER-06 缩放不占位

- **修复**：使用 `zoom: ${zoom}` 替代 `transform: scale()`；或保留 transform 但同步设置容器 `width/height` 补偿。推荐 `zoom`，并监听 `ResizeObserver` 重算滚动高度。
- **验收**：50%/100%/150% 下都能滚动到纸张底部，不出现裁切或大面积空白。

#### RENDER-07 一键单页算法重写

当前实现是“一次性按比例改参数”，且只改一轮。重写为迭代求解：

```
目标：pageCount == target（默认 1），且最后一页填充率 ∈ [0.72, 0.96]
参数优先级（压缩时）：paragraphSpacing → sectionSpacing → lineHeight → fontSize → pagePadding
参数优先级（放大时）：pagePadding → fontSize → lineHeight → sectionSpacing → paragraphSpacing
每轮：调整一步 → nextTick → 重新分页测量 → 判断
最多 12 轮；达到目标即停止
```

- 提供“目标页数：1 页 / 2 页 / 自动”。
- 操作前保存快照，提供“撤销本次自动排版”。
- 若 12 轮仍无法收敛，提示“内容超出 1 页较多，建议精简 1–2 条经历”，并给出具体模块的超出高度。
- 不再直接修改用户数据，只改主题参数。

**验收**：在 3 套模板、内容量 0.6/0.9/1.1/1.4 页四档下，成功率 ≥ 90%，失败时有明确提示。

#### RENDER-08 模板系统重构

**目标**：消除三份复制粘贴，保证行为一致。

```
src/templates/
├── ResumeDocument.vue        # 统一结构：header + 按 modulesOrder 渲染 sections
├── resume.css                # 所有模板共享的排版变量与基础样式
├── ClassicTemplate.vue       # 只保留布局差异（class + 少量插槽）
├── GeekTemplate.vue
├── ModernTemplate.vue
└── blocks/
    ├── SectionWork.vue
    ├── SectionProjects.vue
    ├── SectionSkills.vue
    ├── SectionEducation.vue
    └── SectionCustom.vue
```

**统一行为约束**：

- `modulesOrder` 对所有模板生效（Modern 的侧栏只固定“个人信息”，教育/技能也按顺序进入主栏或侧栏，由模板配置决定，但必须响应排序）。
- `modules.*.title` 在所有模板中生效；Geek 不再硬编码 `# SKILLS & STACK`，改为中文标题 + 英文小标签（可选）。
- `showBorder` 在所有模板中生效。
- `themeColor` 用于：姓名、模块标题、强调线、链接 hover、技能标签边框；链接不再硬编码 `text-blue-600`。
- 模板版本：新增 `templateVersion` 字段，老简历按旧版本渲染，避免升级后外观突变。

**验收**：同一份数据在三套模板中，模块顺序、标题、显隐完全一致；切换模板无内容丢失。

### 2.4 模板内容问题

| 编号 | 问题 | 证据 | 修复 |
| :--- | :--- | :--- | :--- |
| TPL-01 | 简历中使用 emoji 作为联系方式图标（💰📱✉️📍💼🔗） | `ClassicTemplate.vue:58`、`GeekTemplate.vue:50-54`、`ModernTemplate.vue:75-77` | 改用 Lucide 线性图标，或纯文字 + 分隔符；打印更专业 |
| TPL-02 | Geek 模板标题为英文硬编码，中文用户体验割裂 | `GeekTemplate.vue:72-151` | 使用 `modules.*.title`，英文作为副标签可选 |
| TPL-03 | Modern 模板忽略 `modulesOrder`，教育与技能固定侧栏 | `ModernTemplate.vue:90-114` | 统一走 `ResumeDocument` 的 section 顺序 |
| TPL-04 | 技能条目在 Classic 是长句列表，在 Geek 变成巨型标签 | `GeekTemplate.vue:77-82` | 技能数据增加 `type: 'sentence' \| 'tag'`，或在标签模式下截断并换行 |
| TPL-05 | 链接未做协议校验，`javascript:` 可执行 | 见 SEC-01 | 统一 `safeUrl()` |
| TPL-06 | 外链缺少 `rel="noopener noreferrer"` | 各模板 `<a target="_blank">` | 统一补全 |
| TPL-07 | 薪资字段出现在简历头部，国内场景易减分 | `ClassicTemplate.vue:57-59` | 默认不渲染，设置中可开启 |
| TPL-08 | 默认示例头像使用 Unsplash 外链，国内可能加载失败/被墙 | `src/utils/presets.ts:23` | 改为本地 `public/avatar-placeholder.svg` 或内联 SVG |
| TPL-09 | 模板内字号/颜色硬编码，主题色只作用于少数字段 | 各模板 | 统一 CSS 变量 |

### 2.5 分享与统计

#### SHARE-01 统计可伪造且口径不清

- **现象**：`duration` 由客户端上报，`isDownloaded` 由客户端决定；无去重、无机器人过滤、无本人排除；“HR 阅读足迹”暗示访问者身份，实际无法识别。
- **证据**：`functions/api/[[route]].ts:566-588`、`DashboardView.vue:377-396`。
- **修复**：
  1. 改名为“在线访问统计”。
  2. 服务端记录 `cf.country`、`user-agent` 哈希、`referer`；过滤常见爬虫 UA；同一 IP+UA 30 分钟内只记一次浏览。
  3. 所有者访问不计入（分享页带 `?preview=1` 或本地标记）。
  4. 时长改为“页面可见时长”，前端用 `visibilitychange` 累计，服务端限制 0–1800s。
  5. 展示“浏览 / 独立访客 / 下载 / 平均阅读时长”，并注明“统计为估算值”。

#### SHARE-02 下载与浏览重复计数

- **修复**：`reportVisit(true)` 后置 `hasReported = true`；`pagehide` 只上报一次；下载单独记 `download` 事件而非新增一次 visit。

#### SHARE-03 公开链接暴露联系方式

- **修复**：分享设置增加“隐藏手机号/邮箱”；服务端在 `/share/:id` 返回时按设置脱敏（`138****8000`、`z***@example.com`），而不是仅前端遮罩。

#### SHARE-04 无 OG / 二维码 / 有效期

- **修复**：见 4.3.3。

### 2.6 导出系统

#### EXPORT-01 云端导出实际不可用

- **根因 1**：前端未带 Token → 401。
- **根因 2**：后端移除 `<base>`，相对头像 URL 失效。
- **根因 3**：云端 Chromium 的 CJK 字体可用性未验证，存在中文变方框风险。
- **根因 4**：Browser Rendering 有每日额度与并发限制，不适合作为默认通道。
- **修复**：
  1. 前端请求带 `Authorization`；或改为同源 Cookie 鉴权（见 4.3.10）。
  2. 发送前在客户端把所有 `src`/`href` 相对路径转绝对 URL（`new URL(raw, location.origin).href`），后端继续移除 `<base>`。
  3. 预发环境用中文简历实测导出；若无 CJK 字体，云端通道降级为“仅本地打印”，并在 UI 中说明。
  4. **主次调整**：本地打印作为默认与主通道（免费、无额度、字体可靠）；云端下载作为登录用户的“高清直下”可选通道，并显示剩余额度/失败原因。
  5. 导出前校验必填字段（姓名、联系方式），缺项给出提示但不阻塞。
  6. 文件命名统一：`姓名_求职意向_年限.pdf`，去除非法字符。

#### EXPORT-02 多页排版

- 见 RENDER-04/05。

#### EXPORT-03 打印降级时机

- **现象**：`window.print()` 在 `await fetch` 之后调用，部分浏览器会因丢失用户手势而拦截或显示空白。
- **修复**：未登录/云端不可用时，在点击事件同步阶段直接 `window.print()`；或先打开“打印预览”弹窗，由用户点击“打印”按钮触发。

#### EXPORT-04 导出体积与隐私

- **现象**：每次导出都把全量 CSS（约 50KB）内联进 HTML，并上传到服务端；HTML 上限 2MB。
- **修复**：只内联模板所需的 CSS（`resume.css` + 用到的工具类），压缩后通常 < 20KB；服务端限制 512KB；对 HTML 做白名单清洗（见 SEC-04）。

### 2.7 头像与存储

| 编号 | 问题 | 证据 | 修复 |
| :--- | :--- | :--- | :--- |
| ASSET-01 | 无裁剪、无压缩，2MB 原图直传 | `SectionProfile.vue:15-71` | 裁剪弹窗 + Canvas 压缩 WebP 300×300 |
| ASSET-02 | 游客头像转 base64 存入 JSON，可能撑爆 localStorage/D1 | `SectionProfile.vue:64-71` | 改存 IndexedDB；同步云端时先上传 R2 |
| ASSET-03 | 替换头像后旧文件不删除，R2 产生孤儿 | `functions/api/[[route]].ts:451-501` | 新增 `assets` 表 + 定时/惰性清理 |
| ASSET-04 | 上传仅校验 MIME，未校验真实文件头 | 同上 | 读取前 12 字节校验 magic number |
| ASSET-05 | `/api/file/*` 无鉴权，URL 泄露即可访问 | `functions/api/[[route]].ts:504-532` | 可接受；如需更强隐私，改为签名 URL（短期有效） |

### 2.8 后端与安全

| 编号 | 问题 | 证据 | 修复 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| SEC-01 | `:href` 未校验协议，`javascript:` XSS | 模板各 `<a>` | 新增 `safeUrl()`：仅允许 `http/https/mailto`，否则渲染为纯文本；补 `rel="noopener noreferrer"` | P0 |
| SEC-02 | JWT 默认密钥 | `functions/api/[[route]].ts:90,121,166` | 生产环境缺失 `JWT_SECRET` 时直接 500 并记录日志；本地用 `.dev.vars` | P0 |
| SEC-03 | CORS 全开放 | `functions/api/[[route]].ts:11` | 限制为 `env.APP_ORIGIN` 或同源；仅允许必要方法与头 | P1 |
| SEC-04 | `/export-pdf` 接受任意 HTML 并在无头浏览器执行 | `functions/api/[[route]].ts:593-657` | 清洗 `script/iframe/object/embed`、`on*` 属性、`javascript:` URL；限制外部资源域名；每用户每日限额 | P1 |
| SEC-05 | 无登录/注册/访客上报频控 | 全局 | D1 计数表或 Cloudflare Rate Limiting；登录 10 次/分/IP，注册 5 次/小时/IP，visit 60 次/分/IP | P1 |
| SEC-06 | 密码无最大长度、邮箱未归一化 | `functions/api/[[route]].ts:100-132` | `trim().toLowerCase()`；密码 6–128；邮箱 ≤254 | P1 |
| SEC-07 | `JSON.parse` 无保护，脏数据导致 500 | `functions/api/[[route]].ts:269,430,556` | 统一 `safeParse(json, fallback)`；损坏时返回 50001 并记录 | P1 |
| SEC-08 | 公开接口返回 `userId` | `functions/api/[[route]].ts:265` | 公开响应移除内部 ID | P2 |
| SEC-09 | 无安全响应头 | 全局 | 新增 `functions/_middleware.ts`：CSP、`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy` | P1 |
| SEC-10 | 版本历史每 3 分钟写全量快照，无上限 | `functions/api/[[route]].ts:304-322` | 仅在内容哈希变化时写；每份保留 20 个；按时间清理 | P1 |
| SEC-11 | 简历 JSON 无体积上限 | `functions/api/[[route]].ts:278-302` | PUT 限制 512KB；超出返回 40002 | P1 |
| SEC-12 | PBKDF2 100k 可能超出 Workers 免费版 CPU 限制 | `functions/api/[[route]].ts:14-37` | 实测 CPU；必要时降到 30k–50k 或升级套餐；文档注明 | P1 |

### 2.9 性能

| 编号 | 问题 | 证据 | 修复 |
| :--- | :--- | :--- | :--- |
| PERF-01 | 路由全量同步导入，首页加载编辑器与模板代码 | `src/router/index.ts:2-6` | 路由懒加载 `() => import()`；模板按需异步加载 |
| PERF-02 | 工作台 N+1 统计请求 | `DashboardView.vue:162-175` | 后端聚合接口一次返回 |
| PERF-03 | 每次按键深拷贝 + 全量 JSON 写 localStorage | `src/stores/resume.ts:97-105` | 本地存 IndexedDB + 500ms 节流；云端 2.5s 防抖 |
| PERF-04 | 预览区 `transition-all duration-200` 导致每次输入触发布局动画 | `PreviewCanvas.vue:83` | 移除高度过渡，仅对缩放做过渡 |
| PERF-05 | 全量 CSS 内联进导出 HTML | `src/utils/exportPdf.ts:34-49` | 只内联模板 CSS |
| PERF-06 | 无图片懒加载/尺寸声明 | 模板头像 | `loading="lazy"`、`width/height` 固定、压缩后 WebP |
| PERF-07 | 首屏无预连接/预加载 | `index.html` | 对关键路由 `modulepreload`；字体使用系统栈，避免阻塞 |

**包体目标**：首屏 JS（gzip）≤ 120KB（当前约 91KB，但包含全部路由）；新增分页与组件库后仍 ≤ 150KB。

### 2.10 其他功能增强清单

| 编号 | 增强项 | 说明 | 优先级 |
| :--- | :--- | :--- | :--- |
| FUNC-10 | 月份选择器 + “至今” | 统一 `YYYY.MM`，避免格式混乱 | P1 |
| FUNC-11 | 经历条目复制 | 同类岗位快速复用 | P2 |
| FUNC-12 | 条目折叠 | 经历多时减少滚动 | P2 |
| FUNC-13 | 技能分类/标签模式 | 前端/后端/工具/语言分组 | P2 |
| FUNC-14 | 自定义模块 1–3 个 | 当前仅 1 个 | P2 |
| FUNC-15 | 模块标题可编辑 | 工作经历可改为实习经历 | P1 |
| FUNC-16 | 完成度提示 | 必填项 + 内容量 + 量化比例 | P2 |
| FUNC-17 | 内容校验 | 空姓名、无联系方式、占位符 `[xxx]` 残留 | P1 |
| FUNC-18 | 快捷键 | `Ctrl+S`、`Ctrl+Z`、`Ctrl+Shift+Z` | P1 |
| FUNC-19 | 多标签页同步 | `BroadcastChannel` 检测冲突 | P2 |
| FUNC-20 | 简历搜索/排序 | 工作台 | P2 |

---

## 3. 建议下线 / 降级的功能

### 3.1 判定标准

一个功能满足以下任意两条，即应考虑下线或降级：

1. **不可靠**：结果与用户预期不符，或依赖无法保证的外部条件。
2. **误导**：以完成品口径呈现，实际是启发式/估算。
3. **低价值**：使用频率低，但维护成本与认知负担高。
4. **有更优替代**：已有更简单、更可信的实现路径。
5. **合规风险**：隐私、广告法、虚假宣传。

### 3.2 下线 / 降级清单

| 编号 | 功能 | 问题 | 处置 | 迁移/替代 |
| :--- | :--- | :--- | :--- | :--- |
| CUT-01 | 工作台硬编码 demo 卡片 | 混淆真实简历，删除仅本地生效 | **删除** | 游客入口改为 `/editor/new`；示例放入首页示例区 |
| CUT-02 | “HR 阅读足迹”命名与口径 | 无法识别 HR，数据可伪造 | **降级改名**为“在线访问统计”，并去伪 | 保留图表，增加去重/过滤/本人排除 |
| CUT-03 | “ATS 评分”数值 | 启发式打分，关键词提取含噪声，易误导 | **降级**为“JD 关键词对照”，去掉单一分数与“通过率”话术 | 展示覆盖率、已覆盖/未覆盖、建议补充位置 |
| CUT-04 | 缺失关键词“一键补到技能栏” | 直接把 JD 词塞进简历，污染内容且不真实 | **删除一键添加** | 改为“建议添加到技能/项目”的提示，用户手动编辑 |
| CUT-05 | STAR 快捷句式插入 | 插入 `[核心模块/系统]` 占位符，用户常忘替换 | **替换**为结构化 bullet 编辑器 + 动词库 | 见 4.3.6 |
| CUT-06 | 版本历史后端写入（无 UI） | 每 3 分钟写全量 JSON，纯成本无收益 | **暂时停写**，或补齐 UI 后再开 | 见 4.3.2；停写前清理旧数据 |
| CUT-07 | 云端 PDF 作为默认导出 | 401、字体风险、额度限制 | **降级为可选**，本地打印为主 | 见 EXPORT-01 |
| CUT-08 | 首页竞品对比表 | 贬低竞品、绝对化用语，法律风险 | **删除** | 改为能力清单 |
| CUT-09 | 简历内 emoji 图标 | 打印不专业、跨平台字形不一致 | **删除** | Lucide 图标或纯文字 |
| CUT-10 | “忘记密码”无效入口 | 点击只弹 alert | **暂时移除** | 邮件重置上线后再加 |
| CUT-11 | “保持登录状态”复选框 | 未参与逻辑 | **删除**或真正实现 | 二选一 |
| CUT-12 | 模板弹窗中的抽象骨架图 | 无法预览真实效果 | **替换**为真实模板缩略图 | 复用模板组件缩放渲染 |
| CUT-13 | `rememberMe`、`emailTouched` 等未使用状态 | 死代码 | **清理** | — |
| CUT-14 | `resume_history` 无 UI 的恢复接口 | 暴露但不可达 | 保留接口，UI 上线前不对外宣传 | — |
| CUT-15 | 薪资期望字段 | 国内简历中易减分，且多数模板位置突兀 | **默认隐藏**，设置中可开启 | 数据保留，渲染开关 |
| CUT-16 | `text-[10px]` 微文案 | 可读性差 | **统一提升到 11px** | 设计令牌 `text-2xs` |
| CUT-17 | 首页两个重复 CTA 区 | 信息冗余 | **合并为一个** | — |
| CUT-18 | `@cloudflare/puppeteer` 作为默认依赖链 | 体积/部署复杂度 | 保留但按需加载，文档注明额度 | — |

### 3.3 不建议删除的功能（避免误伤）

- **本地打印导出**：这是产品最可信、零成本的差异化能力，应加强而非弱化。
- **三套模板**：是核心卖点，但需要重构而非删除。
- **主题微调**：间距/行高/边距是“一页纸”体验的关键，保留并修复字号。
- **R2 头像**：登录用户的刚需，补齐压缩与清理即可。
- **JD 关键词对照**：需求真实存在，只是当前实现过度承诺；降级后仍有价值。
- **访问统计**：对求职者有心理价值，改名与去伪后可保留。

---

## 4. 扩展路线图：把体验做成闭环

### 4.1 目标用户旅程闭环

```
发现（首页/SEO/示例）
  → 试用（免登录，本地草稿）
  → 制作（结构化填写 + 实时预览 + 一键单页）
  → 校验（内容检查 + JD 关键词对照）
  → 导出（PDF/打印/JSON）
  → 保存（登录同步，多端）
  → 分享（链接/二维码/有效期/脱敏）
  → 反馈（访问统计）
  → 迭代（版本历史/多版本简历）
  → 投递（岗位管理/提醒）
  → 复盘（转化漏斗）
```

当前闭环断在：**试用 → 保存**（草稿重置）、**分享 → 反馈**（分享错内容/统计失真）、**导出**（云端 401）。这三处必须先修。

### 4.2 扩展功能详述

#### 4.2.1 游客本地优先（Guest-first）

| 项 | 设计 |
| :--- | :--- |
| 入口 | `/editor/new`，生成 `local_<uuid>` |
| 存储 | IndexedDB `drafts` 表：`{ id, title, content, themeConfig, templateId, updatedAt }` |
| 自动保存 | 500ms 防抖写 IDB；localStorage 只存“最后打开的草稿 id” |
| 草稿列表 | 首页/工作台展示“本地草稿”，支持继续编辑、删除、导出 |
| 登录迁移 | 登录后弹出选择：同步到云端 / 保留本地 / 丢弃；同步成功跳转云端 id |
| 容量 | IDB 可存数十 MB，头像以 Blob 存储，不再 base64 |
| 兼容 | 启动时把旧 `open_resume_draft:*` 迁移到 IDB，迁移后保留只读备份 7 天 |

**价值**：兑现“免注册直接体验”，降低首次使用门槛；同时避免 localStorage 配额问题。

#### 4.2.2 版本历史（时光机）

| 项 | 设计 |
| :--- | :--- |
| 自动快照 | 内容哈希变化且距上次 ≥10 分钟；每份最多 20 个；超出删最旧 |
| 手动快照 | “保存当前版本”，可命名（如“投递字节版”） |
| UI | 编辑器右侧抽屉时间线；显示时间、标题、字数、模板；支持预览与恢复 |
| 恢复 | 恢复前自动备份当前版本；恢复后 Toast + 可撤销 |
| 存储 | `resume_versions` 表：`id, resume_id, label, snapshot, content_hash, is_auto, created_at` |
| 成本 | 仅变化时写入；单份简历快照 < 50KB，20 份 < 1MB |

**价值**：解决“改坏了回不去”的焦虑；为“一岗一版”提供基础。

#### 4.2.3 分享增强

| 能力 | 设计 |
| :--- | :--- |
| 分享链接 | `/s/:token`，token 随机 16 字节；可撤销、可重建 |
| 有效期 | 7 天 / 30 天 / 永久；过期返回友好页 |
| 密码 | 可选；服务端存 PBKDF2 哈希；访问时输入 |
| 脱敏 | 手机号/邮箱/薪资可隐藏；服务端返回前处理 |
| 下载权限 | 允许/禁止访客下载 PDF |
| 二维码 | 前端用 `qrcode` 生成 Canvas，支持下载 PNG |
| OG 预览 | Pages Function 注入 `og:title/description/image`；图片先静态，后续可生成 |
| 访问通知 | 可选：首次访问/下载时邮件通知所有者（Phase 3） |
| 统计 | 浏览、独立访客、下载、平均时长、来源；过滤本人/爬虫 |

**数据模型**

```sql
CREATE TABLE share_links (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  expires_at INTEGER,
  allow_download INTEGER NOT NULL DEFAULT 1,
  mask_contact INTEGER NOT NULL DEFAULT 1,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_share_token ON share_links(token);
CREATE INDEX idx_share_resume ON share_links(resume_id);
```

#### 4.2.4 导出矩阵

| 格式 | 场景 | 实现 | 优先级 |
| :--- | :--- | :--- | :--- |
| PDF（打印） | 默认，免费无水印 | `window.print()` + 分页 CSS | 已有，修复 |
| PDF（云端） | 登录用户一键直下 | Browser Rendering，限额 | 已有，修复/降级 |
| JSON | 备份、迁移、导入 | `JSON.stringify` 下载 | P1 |
| Markdown | GitHub/技术博客 | 模板转 Markdown | P2 |
| DOCX | 国内 HR 常要求 Word | `docx` 库或 HTML→DOCX | P2 |
| PNG | 社交分享预览 | 可选 `html-to-image` | P3 |
| ATS 友好版 | 投递大厂 | 单栏、无图标、标准标题的模板变体 | P1 |

**导出设置弹窗**：是否含头像、彩色/灰度、页边距、是否含链接、文件名。

#### 4.2.5 导入

| 来源 | 方案 | 优先级 |
| :--- | :--- | :--- |
| OpenResume JSON | 直接校验并载入 | P1 |
| 粘贴文本 | 规则解析（按“工作经历/项目/教育”关键词分段） | P2 |
| Markdown | 标题层级映射模块 | P2 |
| PDF/DOCX | 服务端文本抽取 + 规则/LLM 结构化，用户确认 | P3 |

**价值**：降低迁移成本，是拉新的重要入口。

#### 4.2.6 内容助手（规则版优先）

不依赖大模型，先做确定性能力：

1. **量化检测**：每条 bullet 检测数字+单位；未量化时显示“可补充数据”提示（不阻塞）。
2. **弱动词替换**：`负责/参与/协助` → 建议 `主导/搭建/重构/推动`，提供一键替换（需确认）。
3. **占位符残留**：检测 `[xxx]`、`XX`、`某公司` 等，导出前提醒。
4. **长度建议**：单条 ≤ 2 行（约 60 字），每段 3–5 条；超长时提示拆分。
5. **重复词/空洞词**：`良好的`、`较强的`、`丰富的` 等，建议删除或具体化。
6. **结构化 bullet 编辑器**：每条 bullet 为一行，支持拖拽、复制、删除；可选“STAR 四格”辅助输入（背景/任务/行动/结果），自动拼成一句话。

**AI 增强（Phase 3，可选）**：
- 使用 Cloudflare Workers AI 或用户自带 Key；
- 只做“改写建议”，必须展示 diff 并由用户确认；
- 明确隐私提示：内容会发送至模型服务；
- 限流与成本上限。

#### 4.2.7 JD 关键词对照 v2

| 项 | 设计 |
| :--- | :--- |
| 命名 | “JD 关键词对照”，不称“ATS 评分” |
| 分词 | 中文词典 + 英文技术词正则 + 同义词归一（Vue3/Vue.js、React/React.js、K8s/Kubernetes） |
| JD 结构 | 区分“岗位职责/任职要求”，要求部分权重更高 |
| 输出 | 覆盖率（明确标注“基于关键词匹配，仅供参考”）、已覆盖、未覆盖、建议补充位置 |
| 交互 | 未覆盖词点击后展示“添加到技能 / 在项目描述中补充”的建议，不自动写入 |
| 评分 | 去掉 0–100 单一分数，或改为分维度（关键词/量化/动词）并解释算法 |
| 隐私 | 全部本地计算，不上传 JD |

#### 4.2.8 模板与示例库

| 项 | 设计 |
| :--- | :--- |
| 真实缩略图 | 用模板组件 `scale(0.3)` 渲染，截图缓存到 R2（可选） |
| 模板元数据 | `industry[]`、`columns`、`photo`、`atsSafe`、`language` |
| 新增模板 | ATS 单栏、学术 CV、设计感、应届生、英文 |
| 示例库 | 6–10 个岗位示例，带完整内容；“以此为例新建” |
| 模板版本 | `templateVersion` 保证老简历外观不变 |
| 模板市场 | Phase 4：用户投稿/主题包（谨慎，需审核） |

#### 4.2.9 投递管理（Job Tracker）

| 项 | 设计 |
| :--- | :--- |
| 视图 | 看板（已投/笔试/面试/Offer/拒绝）+ 列表 |
| 字段 | 公司、岗位、链接、投递时间、状态、关联简历、下一步、备注 |
| 提醒 | 下一步时间到期在 Dashboard 顶部提示；可选邮件 |
| 统计 | 投递数、面试率、Offer 率、各简历使用次数 |
| 数据 | `job_applications` 表；API CRUD |
| 价值 | 把“做简历”扩展为“求职管理”，显著提升留存 |

```sql
CREATE TABLE job_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resume_id TEXT,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at INTEGER,
  next_action_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_jobs_user ON job_applications(user_id);
```

#### 4.2.10 账号与合规

| 能力 | 说明 | 优先级 |
| :--- | :--- | :--- |
| 邮件验证 | 注册后验证邮箱；未验证限制分享 | P2 |
| 密码重置 | 邮件一次性链接（需邮件服务商） | P2 |
| 修改密码 | 旧密码校验 + 强度要求 | P2 |
| 数据导出 | 导出全部简历 JSON + 头像 ZIP | P2 |
| 账号注销 | 二次确认 + 7 天冷静期 + 级联删除 | P2 |
| 登录设备管理 | 可选；显示最近登录 | P3 |
| 隐私政策/服务条款 | 独立页面，注册时勾选 | P1 |
| 数据保留 | 访问记录 180 天；版本 20 个；注销 7 天后清除 | P1 |

#### 4.2.11 国际化与英文简历

| 项 | 设计 |
| :--- | :--- |
| UI i18n | `vue-i18n`，默认 `zh-CN`，支持 `en` |
| 简历语言 | `content.locale`；模块标题自动翻译；日期格式适配 |
| 英文模板 | 无照片、无薪资、无性别、单栏 ATS 友好 |
| 内容差异 | 英文简历强调 action verb + metric，弱化“政治面貌”等字段 |
| 切换 | 顶部语言切换；切换只影响 UI，不改内容 |

#### 4.2.12 SEO 与获客

| 项 | 设计 |
| :--- | :--- |
| 示例页 | `/examples/frontend`、`/examples/product` 等静态页，含真实简历预览与下载 |
| 指南页 | “如何写项目经历”“STAR 法则”等长尾内容 |
| 预渲染 | 营销页用 `vite-ssg` 或构建期生成静态 HTML；编辑器保持 SPA |
| 结构化数据 | `SoftwareApplication`、`FAQPage` |
| sitemap/robots | `public/sitemap.xml`、`public/robots.txt` |
| 分享 OG | 见 4.2.3 |

#### 4.2.13 PWA 与离线

| 项 | 设计 |
| :--- | :--- |
| 缓存 | `vite-plugin-pwa` 预缓存 app shell 与模板 |
| 离线编辑 | 草稿在 IDB；离线可编辑、可打印 |
| 安装 | 提供安装引导（移动端） |
| 更新 | 新版本提示“刷新以更新” |
| 价值 | 兑现“本地优先”，提升移动端体验 |

#### 4.2.14 可观测性与运营

| 项 | 设计 |
| :--- | :--- |
| 前端错误 | `window.onerror` + `unhandledrejection` 上报到 Cloudflare Analytics 或 Sentry |
| 性能 | Web Vitals 上报（LCP/CLS/INP） |
| 业务 | 事件埋点：创建、保存、导出、分享、注册（匿名聚合） |
| 服务端 | 结构化日志 + request id；导出失败原因分类 |
| 告警 | 导出失败率、登录失败率、D1 错误率阈值告警 |

### 4.3 技术基础设施

| 项 | 现状 | 目标 |
| :--- | :--- | :--- |
| 类型共享 | `src/types` 与 `functions/types` 分离 | 新建 `shared/`，前后端共用 `ResumeContent`、`ApiResponse`、`ThemeConfig` |
| 数据校验 | 无 | 引入 `zod`（仅服务端与导入路径），校验请求体与简历 JSON |
| Schema 迁移 | 仅 `schema.sql` | `docs/migrations/0001_*.sql` + `schema_migrations` 表 |
| 测试 | 1 个脚本 | Vitest 单测 + Playwright E2E + 视觉回归 |
| CI/CD | 无 | GitHub Actions：typecheck → unit → build → e2e smoke → Pages 预览部署 |
| 错误处理 | 分散 | `src/utils/http.ts` + 全局 `errorHandler` + `AppErrorState` |
| 配置 | `wrangler.toml` 注释 | `.dev.vars.example`、生产 Secret 清单、部署检查脚本 |
| 依赖 | 模板/视图全量打包 | 路由懒加载 + 模板按需加载 |
| 监控 | 无 | Web Analytics + Workers 日志 + 导出失败告警 |

---

## 5. 实施计划

### 5.1 里程碑与 Sprint

> 以 1 名前端 + 1 名全栈（或 1 人全栈）估算；时间为人日，含自测与联调。

#### Sprint 0：止血与安全网（4–5 人日）

| 任务 | 编号 | 产出 |
| :--- | :--- | :--- |
| 修复游客草稿重置 | FUNC-01 | `/editor/new` + demo 不再重置 |
| 修复登录迁移 URL | FUNC-02/03 | 登录后 `replace` 到云端 id |
| 修复分享 demo | FUNC-02 | demo 分享禁用或生成快照 |
| URL 安全校验 | SEC-01 | `safeUrl()` + 全模板替换 |
| JWT 密钥 fail-closed | SEC-02 | 生产缺 Secret 直接 500 |
| 云端导出鉴权与头像 URL | FUNC-04/05 | 带 Token + 绝对 URL |
| 分页测量修复 | RENDER-01 | 无内容时不显示断线、页数正确 |
| 移除无效 Tailwind 类 | UX-01 | 全项目替换 |
| 添加 favicon/meta/OG 基础 | SEO | `public/favicon.svg`、meta |
| 添加 `_redirects` 与 404 | 部署 | 显式 SPA fallback + 404 页 |
| 全局 401 处理 | DATA-05 | `http.ts` + 跳转登录 |

**出口标准**：游客“编辑→离开→返回”内容不丢；登录后刷新不丢；分享链接内容正确；构建通过；核心链路手动回归通过。

#### Sprint 1：设计系统与页面统一（8–10 人日）

| 任务 | 产出 |
| :--- | :--- |
| 设计令牌与 Tailwind 改造 | 1.3 |
| UI 基础组件（Button/Input/Modal/Toast/Confirm 等） | 1.4 |
| 替换全部 `alert/confirm` | 19 处 → Toast/Confirm |
| 统一 `gray→slate`、主色收敛 | 1.3.3 |
| 首页重构 | 1.5.2 |
| 登录/注册合并 | 1.5.3 |
| 工作台重构 | 1.5.4 |
| 移动端编辑器 Tab 布局 | 1.5.5 |
| A11y 基础 | 1.7 |

**出口标准**：视觉验收清单全部通过；移动端 375px 可完成编辑与导出；无 `alert`。

#### Sprint 2：排版引擎重构（10–12 人日）

| 任务 | 产出 |
| :--- | :--- |
| `ResumeDocument` + 模板共享结构 | RENDER-08 |
| 模板 CSS 变量化（字号/间距/颜色） | RENDER-02 |
| 真分页引擎 | RENDER-05 |
| 打印/导出分页修复 | RENDER-04 |
| AutoFit v2 | RENDER-07 |
| 缩放修复 | RENDER-06 |
| 模板真实缩略图 | CUT-12 |
| 视觉回归测试 | 3 模板 × 3 主题 × 2 字号 |

**出口标准**：预览页数 = 打印页数；字号滑块全量生效；Modern AutoFit 正常；两页简历第二页有页边距。

#### Sprint 3：数据可靠性与分享闭环（8–10 人日）

| 任务 | 产出 |
| :--- | :--- |
| IndexedDB 游客草稿 | 4.2.1 |
| 撤销/重做 + 离开保护 + 保存队列 | DATA-06/07 |
| 头像裁剪压缩 | ASSET-01/02 |
| 分享弹窗（二维码/有效期/脱敏） | 4.2.3 |
| OG 注入 Function | SHARE-04 |
| 访问统计去伪与改名 | SHARE-01/02 |
| 版本历史 UI | 4.2.2 |

**出口标准**：断网编辑可恢复；分享链接有社交预览；统计不含本人与爬虫；版本可恢复。

#### Sprint 4：内容与导出增强（8–10 人日）

| 任务 | 产出 |
| :--- | :--- |
| JD 关键词对照 v2 | 4.2.7 |
| 内容检查（占位符/弱动词/量化/长度） | 4.2.6 |
| 导出矩阵：JSON/Markdown/DOCX | 4.2.4 |
| ATS 友好模板 | 4.2.8 |
| 示例库 6 个岗位 | 4.2.8 |
| 导入 JSON/文本 | 4.2.5 |
| 隐私政策/条款 | 4.2.10 |

**出口标准**：内容检查可关闭且不误报；DOCX 在 Word/WPS 中可正常打开；示例库可一键新建。

#### Sprint 5+：增长与成熟（持续）

- 投递管理（4.2.9）
- 英文简历与 i18n（4.2.11）
- SEO 示例页与指南（4.2.12）
- PWA/离线（4.2.13）
- 邮件验证/重置/注销（4.2.10）
- AI 改写（可选，4.2.6）

### 5.2 文件级改动清单

| 文件/目录 | 动作 | 说明 |
| :--- | :--- | :--- |
| `tailwind.config.js` | 重写 | 设计令牌、字号、阴影、圆角 |
| `src/assets/main.css` | 重写 | 变量、打印分页、A11y、滚动条 |
| `src/components/ui/*` | 新增 | Button/Input/Modal/Toast/Confirm 等 |
| `src/components/AppHeader.vue` / `AppFooter.vue` | 新增 | 统一壳层 |
| `src/components/AppErrorState.vue` | 新增 | 错误/空态 |
| `src/views/HomeView.vue` | 重构 | 真实预览、示例、能力清单 |
| `src/views/LoginView.vue` | 重构 | 复用 AuthModal 逻辑 |
| `src/views/DashboardView.vue` | 重构 | 去 demo、新建流程、搜索、聚合统计 |
| `src/views/EditorView.vue` | 重构 | 移动端 Tab、加载态、离开保护 |
| `src/views/ShareView.vue` | 重构 | OG、脱敏、下载、统计修复 |
| `src/views/NotFoundView.vue` | 新增 | 404 |
| `src/modules/editor/EditorHeader.vue` | 重构 | 返回工作台、保存菜单、导出菜单 |
| `src/modules/editor/FormPanel.vue` | 重构 | 模块管理抽屉、折叠、锚点 |
| `src/modules/editor/PreviewCanvas.vue` | 重构 | 真分页、缩放、页导航 |
| `src/modules/editor/StyleDrawer.vue` | 重构 | 目标页数、AutoFit 撤销、预设 |
| `src/modules/editor/Section*.vue` | 增强 | 日期选择器、校验、复制、折叠 |
| `src/templates/ResumeDocument.vue` | 新增 | 统一文档结构 |
| `src/templates/resume.css` | 新增 | 模板变量与基础排版 |
| `src/templates/*Template.vue` | 重构 | 只保留布局差异 |
| `src/composables/usePagination.ts` | 新增 | 分页引擎 |
| `src/composables/useAutoFit.ts` | 新增 | 迭代求解 |
| `src/composables/useUndoRedo.ts` | 新增 | 撤销栈 |
| `src/composables/useToast.ts` / `useConfirm.ts` | 新增 | 全局反馈 |
| `src/utils/http.ts` | 新增 | 请求封装、401、超时 |
| `src/utils/url.ts` | 新增 | `safeUrl()` |
| `src/utils/image.ts` | 新增 | 裁剪压缩 |
| `src/utils/idb.ts` | 新增 | 草稿存储 |
| `src/stores/resume.ts` | 重构 | 保存队列、暂停逻辑、撤销接入 |
| `src/stores/auth.ts` | 增强 | 过期处理、刷新 |
| `src/router/index.ts` | 增强 | 懒加载、`/editor/new`、404 |
| `functions/api/[[route]].ts` | 重构 | 校验、频控、限流、聚合统计、分享 token |
| `functions/_middleware.ts` | 新增 | 安全头、OG 注入 |
| `functions/types.ts` | 增强 | Env 增加 `APP_ORIGIN`、`JWT_SECRET` 必填 |
| `docs/schema.sql` | 更新 | `share_links`、`job_applications`、`assets`、索引 |
| `docs/migrations/*.sql` | 新增 | 版本化迁移 |
| `public/favicon.svg` | 新增 | 修复 404 |
| `public/_redirects` | 新增 | 显式 SPA fallback |
| `public/robots.txt` / `sitemap.xml` | 新增 | SEO |
| `public/og-default.png` | 新增 | 默认分享图 |
| `tests/*` | 扩展 | Vitest + Playwright |
| `.github/workflows/ci.yml` | 新增 | CI |

### 5.3 风险与应对

| 风险 | 影响 | 概率 | 应对 |
| :--- | :--- | :--- | :--- |
| Cloudflare 在中国大陆访问不稳定 | 目标用户首屏慢/打不开 | 中高 | 上线前用多地域实测；必要时接入国内 CDN 或提供镜像；首页做轻量化 |
| 云端 Chromium 缺少中文字体 | 导出中文变方框 | 中 | 预发实测；无字体则关闭云端通道，主推本地打印 |
| Browser Rendering 额度/并发限制 | 导出失败 | 中高 | 本地打印为主；云端限额 + 失败提示 |
| 模板重构导致老简历外观变化 | 用户投诉 | 中 | `templateVersion` 冻结；灰度；提供“恢复旧版” |
| 分页引擎性能 | 输入卡顿 | 中 | 节流 + rAF；仅页数变化时重建；虚拟化长文档 |
| 设计系统改造范围大 | 延期 | 高 | 按页面分批；先用 codemod 替换类名；视觉回归兜底 |
| 数据迁移丢失 | 用户数据损坏 | 低高 | 迁移前导出备份；双写 7 天；迁移脚本幂等 |
| 安全修复影响现有链接 | 外链失效 | 低 | `safeUrl` 对非法协议降级为文本并提示；不删除数据 |
| PBKDF2 超 CPU 限制 | 登录失败 | 中 | 实测；降迭代次数或升级套餐；监控 5xx |

### 5.4 验收指标

#### 技术指标

| 指标 | 目标 |
| :--- | :--- |
| 首屏 LCP（国内实测） | ≤ 1.8s |
| 首屏 JS（gzip） | ≤ 120KB |
| 编辑器输入到预览更新 | ≤ 50ms（常规内容） |
| 保存成功率 | ≥ 99.5% |
| 导出成功率（本地打印） | ≥ 99% |
| 云端导出成功率（如保留） | ≥ 95%，失败有明确降级 |
| 前端错误率 | < 0.5% sessions |
| 预览页数与打印页数一致率 | 100% |
| 移动端可完成率 | 100%（375px） |

#### 产品指标

| 指标 | 目标 |
| :--- | :--- |
| 游客 → 完成首份简历 | ≥ 40% |
| 游客 → 注册 | ≥ 12% |
| 导出 → 分享 | ≥ 25% |
| 分享链接打开率 | ≥ 60% |
| 7 日留存（登录用户） | ≥ 25% |
| 简历完成度中位数 | ≥ 80% |

### 5.5 Definition of Done

每个任务完成需同时满足：

- [ ] 有对应单元/组件/E2E 测试，或明确说明无法自动化的手动用例。
- [ ] 通过 `npm run build` 与 `vue-tsc` 类型检查。
- [ ] 桌面 1440px + 移动 375px 截图验收。
- [ ] 无新增 `alert/confirm`、无无效 Tailwind 类、无 `gray-*`。
- [ ] 错误路径（网络失败、401、403、空数据）已处理。
- [ ] 文档同步：`PRD.md`、`API.md`、`schema.sql` 与实现一致。

---

## 6. 附录

### 6.1 问题索引（按文件）

| 文件 | 相关问题 |
| :--- | :--- |
| `src/views/EditorView.vue` | FUNC-01、DATA-03、移动端布局 |
| `src/views/DashboardView.vue` | CUT-01、N+1、无重命名、alert |
| `src/views/ShareView.vue` | FUNC-02、SHARE-02、无 OG |
| `src/views/LoginView.vue` | FUNC-03、CUT-10/11、虚假安全文案 |
| `src/views/HomeView.vue` | 营销过载、CUT-08、假截图 |
| `src/components/AuthModal.vue` | FUNC-03、重复实现 |
| `src/components/AtsModal.vue` | CUT-03/04、评分误导 |
| `src/components/TemplateModal.vue` | CUT-12、假缩略图 |
| `src/modules/editor/EditorHeader.vue` | FUNC-02、导出文案、返回入口 |
| `src/modules/editor/PreviewCanvas.vue` | RENDER-01/06、页数错误 |
| `src/modules/editor/StyleDrawer.vue` | RENDER-02、AutoFit 入口 |
| `src/modules/editor/SectionProfile.vue` | ASSET-01/02、无校验 |
| `src/modules/editor/SectionWork.vue` | CUT-05、日期自由文本 |
| `src/modules/editor/SectionProjects.vue` | CUT-05、链接安全 |
| `src/stores/resume.ts` | DATA-03/04/07、RENDER-03/07、默认标题 |
| `src/stores/auth.ts` | 无过期处理 |
| `src/router/index.ts` | 无懒加载、守卫仅查 Token |
| `src/templates/*.vue` | SEC-01、RENDER-02/08、TPL-01~09 |
| `src/utils/exportPdf.ts` | FUNC-04/05、EXPORT-03/04 |
| `src/utils/atsAnalyzer.ts` | CUT-03、分词噪声 |
| `src/utils/presets.ts` | TPL-08、默认数据即“张小凡” |
| `src/assets/main.css` | RENDER-04、打印分页 |
| `functions/api/[[route]].ts` | SEC-02~12、SHARE-01、EXPORT-01 |
| `docs/schema.sql` | 缺 `share_links`、`job_applications`、`assets` |

### 6.2 建议新增 API

| 方法 | 路径 | 说明 |
| :--- | :--- | :--- |
| `POST` | `/api/resumes/:id/duplicate` | 服务端复制，避免客户端两次请求 |
| `PATCH` | `/api/resumes/:id` | 仅更新标题/模板/公开状态，减少全量写 |
| `GET` | `/api/resumes/stats` | 一次返回所有简历的浏览/下载汇总 |
| `GET` | `/api/resumes/:id/versions` | 版本列表 |
| `POST` | `/api/resumes/:id/versions` | 手动创建版本 |
| `POST` | `/api/resumes/:id/versions/:vid/restore` | 恢复版本 |
| `POST` | `/api/resumes/:id/share-links` | 创建分享链接（有效期/密码/脱敏） |
| `DELETE` | `/api/share-links/:id` | 撤销分享链接 |
| `GET` | `/api/s/:token` | 通过 token 获取公开简历 |
| `POST` | `/api/auth/password-reset/request` | 请求重置邮件 |
| `POST` | `/api/auth/password-reset/confirm` | 确认重置 |
| `GET` | `/api/me/export` | 导出个人全部数据 |
| `DELETE` | `/api/me` | 注销账号 |
| `GET/POST/PATCH/DELETE` | `/api/jobs` | 投递管理 |
| `GET` | `/api/templates` | 模板元数据（供首页/弹窗） |

### 6.3 建议数据模型变更

```sql
-- 简历表增加版本与软删除
ALTER TABLE resumes ADD COLUMN template_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resumes ADD COLUMN deleted_at INTEGER;
ALTER TABLE resumes ADD COLUMN content_hash TEXT;

-- 版本表替换 resume_history（保留旧表迁移）
CREATE TABLE IF NOT EXISTS resume_versions (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  label TEXT,
  snapshot TEXT NOT NULL,
  content_hash TEXT,
  is_auto INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_versions_resume ON resume_versions(resume_id, created_at DESC);

-- 访问记录增强
ALTER TABLE resume_visits ADD COLUMN visitor_hash TEXT;
ALTER TABLE resume_visits ADD COLUMN referrer TEXT;
ALTER TABLE resume_visits ADD COLUMN country TEXT;
ALTER TABLE resume_visits ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resume_visits ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_visits_resume_time ON resume_visits(resume_id, created_at DESC);

-- 资源表（清理 R2 孤儿）
CREATE TABLE IF NOT EXISTS assets (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resume_id TEXT,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 迁移版本
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 6.4 模板 CSS 变量示例

```css
/* src/templates/resume.css */
.resume-doc {
  --rs-font-size: 14px;
  --rs-line-height: 1.5;
  --rs-color: #2563eb;
  --rs-section-gap: 16px;
  --rs-para-gap: 6px;
  --rs-page-pad: 18mm;
  --rs-text: #1f2937;
  --rs-muted: #6b7280;
  --rs-border: #e5e7eb;

  font-size: var(--rs-font-size);
  line-height: var(--rs-line-height);
  color: var(--rs-text);
  background: #fff;
}

.rs-name { font-size: 1.72em; font-weight: 700; color: var(--rs-color); }
.rs-job-title { font-size: 1.05em; color: #374151; }
.rs-contact { font-size: .86em; color: var(--rs-muted); }
.rs-section { margin-bottom: var(--rs-section-gap); }
.rs-section-title {
  font-size: 1em;
  font-weight: 700;
  color: var(--rs-color);
  border-bottom: 1px solid var(--rs-border);
  padding-bottom: .25em;
  margin-bottom: .5em;
}
.rs-item { margin-bottom: var(--rs-para-gap); break-inside: avoid; }
.rs-item-title { font-size: 1em; font-weight: 600; }
.rs-meta { font-size: .86em; color: var(--rs-muted); }
.rs-body { font-size: 1em; white-space: pre-line; }
```

模板根节点：

```vue
<div
  class="resume-doc"
  :style="{
    '--rs-font-size': `${theme.fontSize}px`,
    '--rs-line-height': theme.lineHeight,
    '--rs-color': theme.themeColor,
    '--rs-section-gap': `${theme.sectionSpacing}px`,
    '--rs-para-gap': `${theme.paragraphSpacing}px`,
    '--rs-page-pad': `${theme.pagePadding}mm`
  }"
>
```

### 6.5 术语表

| 术语 | 说明 |
| :--- | :--- |
| App Chrome | 产品外壳 UI（导航、工具栏、弹窗），与简历文档样式隔离 |
| Resume Document | 简历纸张内的排版内容，打印优先 |
| 真分页 | 将内容按 A4 高度切分为多个独立页面容器，而非一条长纸 |
| AutoFit | 自动调整主题参数使内容收敛到目标页数 |
| 视觉域 | 一套独立的颜色/字体/间距规则集合 |
| 闭环 | 从发现、制作、导出、分享、反馈到迭代的完整用户路径 |

---

## 7. 结论

OpenResume 已经具备一个简历产品所需的核心零件：结构化数据、三套模板、A4 画布、矢量导出、云端存储。当前的问题不是“缺功能”，而是**零件之间的连接不可靠、视觉语言不统一、部分功能过度承诺**。

建议按以下顺序推进：

1. **先修数据与安全**（Sprint 0）：让用户“不丢内容、不分享错内容、不被 XSS”。
2. **再统一视觉与交互**（Sprint 1）：让产品看起来像一个成熟产品，而不是多个页面的拼装。
3. **重写排版引擎**（Sprint 2）：真分页、字号生效、AutoFit 可靠——这是简历产品的核心竞争力。
4. **补齐闭环**（Sprint 3）：本地草稿、撤销、分享增强、统计去伪、版本历史。
5. **扩展价值**（Sprint 4+）：JD 对照、内容检查、导出矩阵、示例库、投递管理、英文简历、AI。

按此路径，v2.0 可以达到“免费、可信、专业”的产品定位；v2.1 之后再谈增长与智能化，避免在基础不牢时堆叠功能。
