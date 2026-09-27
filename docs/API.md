# 极简简历平台 (OpenResume) 后端接口设计文档 (API Specification)

| 规范文档编号 | 版本 | 编写日期 | 架构环境 | 适用阶段 |
| :--- | :--- | :--- | :--- | :--- |
| API-2026-RESUME-001 | v1.0.0 | 2026-09-27 | Cloudflare Workers + Hono + D1 + R2 | 前后端接口对接、开发与联调 |

---

## 1. 全局设计规范与约定

### 1.1 服务与基础路径
- **生产环境 Base URL**：`https://api.yourdomain.com/api` 或 `/api` (Cloudflare Pages Functions 同域反代)
- **本地开发 Base URL**：`http://127.0.0.1:8787/api` (Wrangler 本地模拟器)
- **协议**：统一采用 `HTTPS`，字符集 `UTF-8`。
- **数据格式**：请求和响应的 Content-Type 默认均为 `application/json; charset=utf-8`（文件上传接口除外，为 `multipart/form-data`）。

### 1.2 认证与权限传递
- 采用 **JWT (JSON Web Token)** 无状态认证机制。
- 登录成功后，客户端需在所有受保护接口的 HTTP 请求头中附带：
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
- 若未提供 Token 或 Token 过期失效，统一返回 HTTP 状态码 `401 Unauthorized`。

### 1.3 统一响应数据结构 (`ApiResponse<T>`)
所有接口返回格式均保持如下统一结构：

#### 成功响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

#### 失败响应格式
```json
{
  "code": 40001,
  "message": "邮箱格式不正确",
  "data": null
}
```

### 1.4 全局业务状态码表 (Error Codes)
| 业务码 (`code`) | HTTP 状态码 | 说明 (Description) |
| :--- | :--- | :--- |
| `0` | 200 | 操作成功 (Success) |
| `40000` | 400 | 通用客户端请求参数错误 |
| `40001` | 400 | 邮箱或密码格式不合法 |
| `40002` | 400 | 用户已存在，无法重复注册 |
| `40003` | 400 | 上传文件格式或体积超出限制（仅限图片且 ≤ 2MB） |
| `40101` | 401 | 缺少认证 Token 或签名无效 |
| `40102` | 401 | Token 已过期，请重新登录 |
| `40103` | 401 | 账号或密码错误 |
| `40301` | 403 | 无权限操作该简历资源（非当前所有者） |
| `40401` | 404 | 请求的资源（简历/文件/用户）不存在 |
| `50001` | 500 | 边缘服务或数据库内部执行错误 |

---

## 2. 接口详细规格说明

### 2.1 用户认证模块 (Authentication)

#### 2.1.1 用户注册
- **接口功能**：创建新用户账号并初始化默认简历骨架。
- **请求方法**：`POST`
- **请求路径**：`/api/auth/register`
- **权限要求**：公开免鉴权

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 限制说明 | 示例值 |
| :--- | :--- | :--- | :--- | :--- |
| `email` | string | 是 | 有效邮箱格式，长度 ≤ 64 | `xiaofan@example.com` |
| `password` | string | 是 | 6~32 位字符 | `Pass123456` |
| `nickname` | string | 否 | 长度 ≤ 20，默认取邮箱前缀 | `张小凡` |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_9b1deb4d3b7d4e12",
      "email": "xiaofan@example.com",
      "nickname": "张小凡",
      "avatarUrl": ""
    }
  }
}
```

---

#### 2.1.2 用户登录
- **接口功能**：验证凭证，颁发 JWT Token。
- **请求方法**：`POST`
- **请求路径**：`/api/auth/login`
- **权限要求**：公开免鉴权

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 示例值 |
| :--- | :--- | :--- | :--- |
| `email` | string | 是 | `xiaofan@example.com` |
| `password` | string | 是 | `Pass123456` |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_9b1deb4d3b7d4e12",
      "email": "xiaofan@example.com",
      "nickname": "张小凡",
      "avatarUrl": "https://r2.yourdomain.com/avatars/avatar_123.webp"
    }
  }
}
```

---

#### 2.1.3 获取当前登录用户信息
- **接口功能**：用于前端初始化鉴权状态，维持登录态。
- **请求方法**：`GET`
- **请求路径**：`/api/auth/me`
- **权限要求**：需携带 Bearer Token

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "usr_9b1deb4d3b7d4e12",
    "email": "xiaofan@example.com",
    "nickname": "张小凡",
    "avatarUrl": "https://r2.yourdomain.com/avatars/avatar_123.webp",
    "createdAt": 1727400000
  }
}
```

---

#### 2.1.4 修改个人资料
- **接口功能**：更新昵称或默认个人头像。
- **请求方法**：`PUT`
- **请求路径**：`/api/auth/profile`
- **权限要求**：需携带 Bearer Token

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 示例值 |
| :--- | :--- | :--- | :--- |
| `nickname` | string | 否 | `极客小凡` |
| `avatarUrl` | string | 否 | `https://r2.yourdomain.com/avatars/new.webp` |

---

### 2.2 简历管理与内容持久化模块 (Resume Management)

#### 2.2.1 获取我的简历列表
- **接口功能**：获取当前用户拥有的所有简历元数据列表（精简模式，不传输庞大的 content，极大提升加载速度并节约 D1 读配额）。
- **请求方法**：`GET`
- **请求路径**：`/api/resumes`
- **权限要求**：需携带 Bearer Token

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "res_8f7b2c9d1a3e",
      "title": "前端技术专家-张小凡",
      "templateId": "classic",
      "isPublic": 0,
      "createdAt": 1727401200,
      "updatedAt": 1727415600
    },
    {
      "id": "res_0a1b2c3d4e5f",
      "title": "应届生求职-张小凡",
      "templateId": "geek",
      "isPublic": 1,
      "createdAt": 1727300000,
      "updatedAt": 1727310000
    }
  ]
}
```

---

#### 2.2.2 创建一份新简历
- **接口功能**：新建一份简历，可选择载入默认空白骨架或内置的典型求职范文。
- **请求方法**：`POST`
- **请求路径**：`/api/resumes`
- **权限要求**：需携带 Bearer Token

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 说明 | 示例值 |
| :--- | :--- | :--- | :--- | :--- |
| `title` | string | 否 | 简历标题（默认“未命名简历”） | `前端架构师简历` |
| `templateId` | string | 否 | 预设模板 ID (默认 `classic`) | `classic` / `geek` / `modern` |
| `initType` | string | 否 | `example` (带范文数据) 或 `blank` (空骨架) | `example` |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "创建成功",
  "data": {
    "id": "res_8f7b2c9d1a3e",
    "title": "前端架构师简历",
    "templateId": "classic"
  }
}
```

---

#### 2.2.3 获取单份简历详情
- **接口功能**：进入编辑器时调用，获取完整的简历内容树与排版样式配置。
- **请求方法**：`GET`
- **请求路径**：`/api/resumes/:id`
- **权限要求**：需携带 Bearer Token (仅简历所有者可读取)

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "res_8f7b2c9d1a3e",
    "userId": "usr_9b1deb4d3b7d4e12",
    "title": "前端架构师简历",
    "templateId": "classic",
    "content": {
      "profile": {
        "name": "张小凡",
        "title": "资深前端工程师",
        "email": "xiaofan@example.com",
        "phone": "13800138000",
        "location": "北京·海淀",
        "avatar": "https://r2.yourdomain.com/avatars/avatar_123.webp",
        "showAvatar": true,
        "github": "https://github.com/example",
        "website": "https://blog.example.com",
        "summary": "5年前端开发经验，精通Vue3与现代工程化体系..."
      },
      "modulesOrder": ["education", "work", "projects", "skills", "custom"],
      "modules": {
        "education": {
          "visible": true,
          "title": "教育背景",
          "items": [
            {
              "id": "edu_1",
              "school": "北京航空航天大学",
              "major": "计算机科学与技术",
              "degree": "硕士",
              "startDate": "2019-09",
              "endDate": "2022-06",
              "description": "GPA: 3.8/4.0，获得国家研究生奖学金"
            }
          ]
        },
        "work": {
          "visible": true,
          "title": "工作经历",
          "items": [
            {
              "id": "work_1",
              "company": "某知名互联网集团",
              "department": "大前端架构组",
              "position": "资深前端研发",
              "startDate": "2022-07",
              "endDate": "至今",
              "description": "• 负责设计并主导轻量级微前端底座落地，支撑 10+ 核心业务平滑迁移；\n• 深度调优首屏加载性能，核心交互卡顿率降低 65%。"
            }
          ]
        },
        "projects": {
          "visible": true,
          "title": "项目经历",
          "items": [
            {
              "id": "proj_1",
              "name": "高性能在线协同排版引擎",
              "role": "核心架构师",
              "startDate": "2023-03",
              "endDate": "2023-11",
              "link": "https://github.com/example/engine",
              "description": "基于 Vue3 + Canvas 开发的实时所见即所得编辑器。"
            }
          ]
        },
        "skills": {
          "visible": true,
          "title": "专业技能",
          "items": [
            "精通 Vue3、TypeScript、Pinia 架构体系与响应式原理",
            "精通浏览器关键渲染路径、CSS Paged Media 与前端高保真打印方案",
            "熟练运用 Cloudflare Workers / D1 / R2 等 Serverless 边缘云原生生态"
          ]
        },
        "custom": {
          "visible": false,
          "title": "荣誉奖项",
          "items": [
            "2023 年度团队技术突破奖",
            "全国大学生程序设计竞赛 (ACM-ICPC) 铜牌"
          ]
        }
      }
    },
    "themeConfig": {
      "themeColor": "#2563EB",
      "fontFamily": "font-sans",
      "fontSize": 14,
      "lineHeight": 1.5,
      "paragraphSpacing": 8,
      "sectionSpacing": 16,
      "pagePadding": 20,
      "showBorder": true
    },
    "isPublic": 0,
    "updatedAt": 1727415600
  }
}
```

---

#### 2.2.4 更新保存简历 (自动防抖保存 / 手动保存)
- **接口功能**：将编辑器中修改的内容树、排版配置保存至 Cloudflare D1。
- **请求方法**：`PUT`
- **请求路径**：`/api/resumes/:id`
- **权限要求**：需携带 Bearer Token

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | string | 否 | 简历标题 |
| `templateId` | string | 否 | 所选模板 ID |
| `content` | object | 是 | 完整的简历数据对象 (结构见 2.2.3) |
| `themeConfig` | object | 是 | 排版样式对象 (结构见 2.2.3) |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "id": "res_8f7b2c9d1a3e",
    "updatedAt": 1727416900
  }
}
```

---

#### 2.2.5 快捷重命名简历
- **接口功能**：看板中即时双击重命名，避免全量提交庞大的 content 结构。
- **请求方法**：`PATCH`
- **请求路径**：`/api/resumes/:id/title`
- **权限要求**：需携带 Bearer Token

**请求 Body (JSON)**：
```json
{
  "title": "2026最新大厂通用版-张小凡"
}
```

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "修改成功",
  "data": {
    "id": "res_8f7b2c9d1a3e",
    "title": "2026最新大厂通用版-张小凡"
  }
}
```

---

#### 2.2.6 复制克隆简历 (Duplicate)
- **接口功能**：以已有简历为蓝本完整深拷贝出一份全新副本。
- **请求方法**：`POST`
- **请求路径**：`/api/resumes/:id/duplicate`
- **权限要求**：需携带 Bearer Token

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "复制成功",
  "data": {
    "id": "res_c4d5e6f7a8b9",
    "title": "前端架构师简历_副本",
    "templateId": "classic"
  }
}
```

---

#### 2.2.7 删除简历
- **接口功能**：物理/软删除指定的简历记录。
- **请求方法**：`DELETE`
- **请求路径**：`/api/resumes/:id`
- **权限要求**：需携带 Bearer Token

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "删除成功",
  "data": {
    "id": "res_8f7b2c9d1a3e"
  }
}
```

---

### 2.3 只读分享与公共查看模块 (Public Share)

#### 2.3.1 开启/关闭公开在线分享
- **接口功能**：生成供招聘官/HR 线上免登录只读浏览的公共链接。
- **请求方法**：`POST`
- **请求路径**：`/api/resumes/:id/share`
- **权限要求**：需携带 Bearer Token

**请求 Body (JSON)**：
| 参数名 | 类型 | 必填 | 说明 | 示例值 |
| :--- | :--- | :--- | :--- | :--- |
| `enable` | boolean | 是 | `true` 开启，`false` 关闭 | `true` |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "分享设置成功",
  "data": {
    "isPublic": 1,
    "shareUrl": "https://resume.yourdomain.com/share/res_8f7b2c9d1a3e"
  }
}
```

---

#### 2.3.2 匿名获取公开简历数据
- **接口功能**：求职者将在线链接发给招聘官或面试官时，前端通过此公开接口获取只读排版数据，页面直接呈现纯净版 A4 画布与导出按钮。
- **请求方法**：`GET`
- **请求路径**：`/api/share/:id`
- **权限要求**：公开免鉴权（但后端校验 `is_public === 1`，若为 0 则返回 40301）

**响应 Data 结构**：
返回数据字段与 `GET /api/resumes/:id` 相同，但不包含当前用户的私有敏感账户信息。

---

### 2.4 多媒体与对象存储模块 (Cloudflare R2 Integration)

#### 2.4.1 上传头像图片
- **接口功能**：接收前端 Canvas 裁剪压缩后的 WebP 图片，直接流式写入 Cloudflare R2 存储桶，并返回边缘 CDN 访问链接。
- **请求方法**：`POST`
- **请求路径**：`/api/upload/avatar`
- **请求 Header**：`Content-Type: multipart/form-data`
- **权限要求**：需携带 Bearer Token

**Form-Data 参数**：
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `file` | File (Binary) | 是 | 图片二进制流，限制格式为 `image/webp, image/jpeg, image/png`，大小 ≤ 2MB |

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "上传成功",
  "data": {
    "url": "https://pub-xxxxxx.r2.dev/avatars/usr_9b1deb4d3b7d4e12_1727415600.webp",
    "size": 45120,
    "mimeType": "image/webp"
  }
}
```

---

### 2.5 预置模板与范文中心 (Presets & Templates)

#### 2.5.1 获取内置模板列表
- **接口功能**：供编辑器和创建弹窗获取系统支持的所有排版模板元信息。
- **请求方法**：`GET`
- **请求路径**：`/api/templates`
- **权限要求**：公开免鉴权

**响应 Data 结构**：
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "classic",
      "name": "经典通用型",
      "description": "黑白极简，商务首选，适合全行业求职",
      "thumbnailUrl": "/templates/classic-thumb.png",
      "tags": ["通用", "商务", "HR推荐"]
    },
    {
      "id": "geek",
      "name": "极简极客型",
      "description": "专为研发人员打造，强调代码与项目链接",
      "thumbnailUrl": "/templates/geek-thumb.png",
      "tags": ["程序员", "技术研发", "简约"]
    },
    {
      "id": "modern",
      "name": "现代侧栏型",
      "description": "左右分栏布局，层次鲜明，视觉出众",
      "thumbnailUrl": "/templates/modern-thumb.png",
      "tags": ["设计", "产品", "双栏"]
    }
  ]
}
```

---

## 3. 前后端共享 TypeScript 契约定义 (Data Models)

为了让前端 Vue 3 (Pinia) 与后端 Hono (Cloudflare Workers) 能够实现类型安全的无缝协作，定义统一的 TypeScript 类型契约：

```typescript
// 1. 全局 API 响应包装
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 2. 用户实体
export interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  createdAt?: number;
}

// 3. 简历排版样式配置
export interface ThemeConfig {
  themeColor: string;       // 十六进制颜色值，如 '#2563EB'
  fontFamily: string;       // 字体族标识
  fontSize: number;         // 基准字号 (px)，如 14
  lineHeight: number;       // 行高比例，如 1.5
  paragraphSpacing: number; // 段落间距 (px)
  sectionSpacing: number;   // 模块外间距 (px)
  pagePadding: number;      // A4 画布内边距 (mm)
  showBorder: boolean;      // 模块分割线开关
}

// 4. 简历基础信息
export interface ResumeProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  location?: string;
  avatar?: string;
  showAvatar: boolean;
  github?: string;
  website?: string;
  summary?: string;
}

// 5. 经历子条目接口定义
export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface WorkItem {
  id: string;
  company: string;
  department?: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  link?: string;
  description: string;
}

// 6. 模块集合定义
export interface ResumeModules {
  education: {
    visible: boolean;
    title: string;
    items: EducationItem[];
  };
  work: {
    visible: boolean;
    title: string;
    items: WorkItem[];
  };
  projects: {
    visible: boolean;
    title: string;
    items: ProjectItem[];
  };
  skills: {
    visible: boolean;
    title: string;
    items: string[];
  };
  custom: {
    visible: boolean;
    title: string;
    items: string[];
  };
}

// 7. 简历完整内容树
export interface ResumeContent {
  profile: ResumeProfile;
  modulesOrder: string[]; // 存放模块唯一标识数组，决定自上而下顺序
  modules: ResumeModules;
}

// 8. 简历主实体 (完整详情)
export interface ResumeDetail {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  content: ResumeContent;
  themeConfig: ThemeConfig;
  isPublic: number;
  createdAt: number;
  updatedAt: number;
}

// 9. 简历列表项 (轻量元数据)
export interface ResumeSummary {
  id: string;
  title: string;
  templateId: string;
  isPublic: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 4. 后端路由实现架构示例 (Hono on Cloudflare Workers)

基于 Hono 框架的路由器组织结构清晰简洁：

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1. 全局中间件
app.use('*', cors());

// 2. 鉴权路由中间件
app.use('/api/resumes/*', (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});
app.use('/api/upload/*', (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
  return jwtMiddleware(c, next);
});

// 3. 模块化子路由挂载
// app.route('/api/auth', authRouter);
// app.route('/api/resumes', resumeRouter);
// app.route('/api/upload', uploadRouter);
// app.route('/api/templates', templateRouter);

export default app;
```
