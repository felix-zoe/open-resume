import { ResumeContent, ThemeConfig } from '../types/resume';

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  themeColor: '#2563EB', // 经典科技蓝
  fontFamily: 'font-sans',
  fontSize: 14,
  lineHeight: 1.5,
  paragraphSpacing: 6,
  sectionSpacing: 16,
  pagePadding: 18,
  showBorder: true
};

export const DEFAULT_RESUME_CONTENT: ResumeContent = {
  profile: {
    name: '张小凡',
    title: '资深前端研发工程师 / 技术专家',
    email: 'xiaofan.zhang@example.com',
    phone: '138 0013 8000',
    location: '北京 · 海淀',
    workYears: '5年全栈研发经验',
    salaryExpectation: '25k-35k',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    showAvatar: true,
    github: 'https://github.com/example',
    website: 'https://blog.example.com',
    summary: '5年前端全栈开发经验，精通 Vue3、TypeScript 与微前端工程化体系。具备大型中后台与高性能富文本引擎设计实战经验，主导过亿级流量产品架构演进。'
  },
  modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
  modules: {
    work: {
      visible: true,
      title: '工作经历',
      items: [
        {
          id: 'work-1',
          company: '某知名头部互联网集团',
          department: '核心研发部 · 大前端架构组',
          position: '前端技术专家',
          startDate: '2022.07',
          endDate: '至今',
          description: '• 负责主导下一代低代码可视化排版引擎架构升级，基于 Web Components 拆分 40+ 业务原子组件，组件复用率达 85%；\n• 针对复杂长列表与画布渲染进行深度虚拟化与 OffscreenCanvas 调优，内存占用降低 45%，FPS 稳定保持在 58+；\n• 推动研发流程 CI/CD 自动化与 ESLint/Prettier 统一规范落地，团队代码审查耗时缩短 30%。'
        },
        {
          id: 'work-2',
          company: '某快速成长型科技独角兽',
          department: '基础平台部',
          position: '高级前端开发工程师',
          startDate: '2020.07',
          endDate: '2022.06',
          description: '• 从 0 到 1 搭建基于 Vue3 + Vite + Pinia 的企业级协同办公系统，支撑全国 200+ 分支机构协同办公；\n• 采用 Web Workers 分担前端大批量数据导出计算，解决了老旧系统导出时界面长时间假死的问题。'
        }
      ]
    },
    projects: {
      visible: true,
      title: '项目经历',
      items: [
        {
          id: 'proj-1',
          name: 'OpenResume 在线高保真简历排版平台',
          role: '独立全栈开发者 & 架构师',
          startDate: '2023.08',
          endDate: '2024.03',
          link: 'https://github.com/open-resume',
          description: '• 针对传统求职网站导出模糊与收费痛点，自研基于 CSS Paged Media 的高保真 A4 原生矢量分页排版引擎；\n• 采用 Cloudflare Workers + D1 + R2 构建全链路零服务器成本架构，接口 P99 响应耗时低于 45ms；\n• 实现数据与排版样式彻底解耦，支持模板一键无缝热切换。'
        },
        {
          id: 'proj-2',
          name: '分布式前端错误监控与告警 SDK',
          role: '核心开发',
          startDate: '2022.10',
          endDate: '2023.04',
          link: 'https://github.com/example/tracker',
          description: '• 封装针对 JS 异常、Promise Unhandled Rejection、资源加载失败及接口超时的通用捕获方案，体积极致压缩至 12KB；\n• 采用 IndexedDB 离线缓存 + 请求空闲 requestIdleCallback 分批上报机制，零侵入宿主业务性能。'
        }
      ]
    },
    skills: {
      visible: true,
      title: '专业技能',
      items: [
        '熟练掌握 Vue3 / TypeScript / Vite 现代前端工程化生态，深入理解响应式原理与组合式 API 设计模式',
        '深入理解浏览器渲染机制、CSS Paged Media 规范、重绘回流性能调优与前端性能度量标准',
        '具备扎实的全栈与 Serverless 视野，熟练运用 Cloudflare Workers / D1 / R2 及 Node.js 服务端开发',
        '具备良好的技术攻坚与团队协作能力，坚持高质量代码审查与单元测试规范'
      ]
    },
    education: {
      visible: true,
      title: '教育背景',
      items: [
        {
          id: 'edu-1',
          school: '北京航空航天大学',
          major: '软件工程',
          degree: '硕士',
          startDate: '2018.09',
          endDate: '2020.06',
          description: 'GPA: 3.82/4.0 (前 5%)，获得国家研究生奖学金、北京市优秀毕业生称号'
        },
        {
          id: 'edu-2',
          school: '山东大学',
          major: '计算机科学与技术',
          degree: '本科',
          startDate: '2014.09',
          endDate: '2018.06',
          description: '主修操作系统、数据结构、编译原理等计算机基础核心课程'
        }
      ]
    },
    custom: {
      visible: true,
      title: '荣誉奖项',
      items: [
        '全国大学生程序设计竞赛 (ACM-ICPC) 区域赛铜奖',
        '2023 年度公司技术卓越贡献奖'
      ]
    }
  }
};
