<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import {
  Sparkles,
  Download,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sliders,
  ChevronRight,
  ArrowRight,
  Check,
  X,
  LayoutTemplate,
  Layers,
  ChevronDown
} from 'lucide-vue-next';

const router = useRouter();

const TEMPLATES = [
  {
    id: 'classic',
    name: '经典通用型 (Classic)',
    tag: 'HR 首选 · 全行业通用',
    desc: '黑白单栏经典排版，信息密度与留白完美平衡，被国内外名企 HR 广泛认可的高通过率标准。',
    colors: ['#2563EB', '#1E293B', '#DC2626'],
    bestFor: '互联网、金融、咨询、国企、传统行业'
  },
  {
    id: 'geek',
    name: '极简极客型 (Geek)',
    tag: '工程师专属 · 强调技术栈',
    desc: '专为研发架构师打造，强化代码项目链接、开源贡献与专业技术栈标签，层次清晰分明。',
    colors: ['#0D9488', '#2563EB', '#1E293B'],
    bestFor: '前端/后端研发、算法工程师、测试、DevOps'
  },
  {
    id: 'modern',
    name: '现代双栏型 (Modern)',
    tag: '设计感十足 · 视觉分明',
    desc: '左右分栏模块化布局，左侧专注个人定位与技能清单，右侧突出核心经历与业务亮点。',
    colors: ['#7C3AED', '#2563EB', '#059669'],
    bestFor: 'UI/UX 设计、产品经理、运营增长、海外双语求职'
  }
];

const startWithTemplate = (templateId: string) => {
  router.push(`/editor/demo?template=${templateId}`);
};

// 核心优势矩阵
const FEATURES = [
  {
    icon: Sparkles,
    title: '算法驱动「一键智能卡页」',
    desc: '独家 Auto-Fit 间距解算算法。经历过多自动无损紧缩，经历较少自动饱满填充，1 秒告别难看的大面积空白与跨页被切。'
  },
  {
    icon: Download,
    title: '无水印超清矢量 PDF 导出',
    desc: '告别竞品导出收费与低清模糊截屏。基于现代浏览器底层原生矢量打印引擎，文字完全可复制、超链接可跳转、零平台水印。'
  },
  {
    icon: Layers,
    title: '数据与排版样式彻底解耦',
    desc: '经历数据（JSON）与排版外观彻底分离。在经典、极客与双栏模板间随意切换，100% 保留所有录入内容，绝不丢字漏行。'
  },
  {
    icon: Zap,
    title: 'Cloudflare 全球边缘分发',
    desc: '全栈依托 Cloudflare 免费云原生生态（Pages + Functions + D1 + R2），全球 Anycast 边缘毫秒级极速响应，安全稳定。'
  },
  {
    icon: Sliders,
    title: '毫米级微调控制台',
    desc: '内置模块垂直间距、行高、字号阶梯、A4 纸边距与色系自由调节滑块，给追求极致排版美感的专业求职者无限自由度。'
  },
  {
    icon: ShieldCheck,
    title: '隐私安全与多端自由访问',
    desc: '支持免登录单机本地创作，亦支持云端账号一键漫游。支持求职照片 R2 云存储与一键只读 HR 分享链接生成。'
  }
];

// 对比表格
const COMPARISONS = [
  { item: 'PDF 导出收费', openResume: '永久免费，无任何套路', others: '导出单次收费 ¥9~¥29 或强制购买会员' },
  { item: 'PDF 导出质量', openResume: '原生矢量文件，文字可复制、链接可点', others: 'html2canvas 模糊图片截图，体积达数十兆' },
  { item: '一页纸控制', openResume: '一键智能卡页算法 + 毫米级微调', others: '手动拖拽极其费劲，部分甚至不给调间距' },
  { item: '强制注册', openResume: '完全不需要，打开网页即可立即制作', others: '强制微信扫码或收集个人手机号' },
  { item: '平台水印', openResume: '100% 纯净，零商业水印', others: '免费用户强行打上巨大收费水印' },
];

// 常见问题手风琴
const openFaqIndex = ref<number | null>(0);
const FAQS = [
  {
    q: 'OpenResume 导出的 PDF 能够通过大厂的 ATS 简历筛选系统吗？',
    a: '完全可以！市面上许多工具采用网页截屏（Canvas）合成图片版 PDF，导致 ATS（Applicant Tracking System）无法抓取任何文字。而 OpenResume 采用浏览器原生 @media print 打印引擎生成的标准矢量 PDF，文字完全可被机器读取、检索，超链接真实有效。'
  },
  {
    q: '我的经历太少（或太多）导致排版很难看，该怎么处理？',
    a: '只需在编辑器顶部点击「✨ 一键单页」按钮！系统会自动通过算法计算当前页面的实际高度，如果超出一页会自动紧缩字距和段落间距；如果少于一页则会自动丰满填充，1 秒实现标准 A4 黄金排版。'
  },
  {
    q: '我的个人隐私信息安全吗？',
    a: '绝对安全。你可以完全不登录账号，在本地纯离线状态下完成简历制作并直接下载 PDF，数据只留存在你的浏览器本地。若选择登录，数据将通过工业级加密存储于 Cloudflare 全球分布式安全边缘网络中。'
  },
  {
    q: '我可以把在线简历直接发给 HR 或面试官吗？',
    a: '支持！点击顶部「分享」按钮即可复制专属在线链接。对方打开后将呈现纯净版 A4 画布，无需登录即可在线阅读或一键下载 PDF。'
  }
];

const toggleFaq = (index: number) => {
  openFaqIndex.value = openFaqIndex.value === index ? null : index;
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-blue-500 selection:text-white">
    <Navbar />

    <!-- 1. Hero 黄金视觉区 -->
    <main class="flex-1 overflow-hidden">
      <section class="relative pt-16 pb-24 lg:pt-24 lg:pb-32 overflow-hidden">
        <!-- 背景微光晕与网格装饰 -->
        <div class="absolute inset-0 -z-10 flex items-center justify-center opacity-60">
          <div class="w-[600px] h-[600px] bg-gradient-to-tr from-blue-400/20 to-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div class="w-[450px] h-[450px] bg-gradient-to-br from-sky-400/20 to-purple-400/20 rounded-full blur-3xl -ml-32"></div>
        </div>

        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <!-- 标签徽章 -->
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-2xs text-slate-700 text-xs font-semibold mb-8 hover:border-blue-300 transition cursor-default">
            <span class="flex h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
            <span class="text-slate-900 font-bold">OpenResume 2.0</span>
            <span class="text-slate-400">|</span>
            <span class="text-blue-600">纯粹、专业、永久免费的现代化简历平台</span>
          </div>

          <!-- 主标题 -->
          <h1 class="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-950 tracking-tight leading-[1.15]">
            制作真正专业的求职简历<br class="hidden sm:inline" />
            <span class="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              告别收费水印与排版焦虑
            </span>
          </h1>

          <!-- 副标题 -->
          <p class="mt-6 text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            对标一线大厂高通过率排版标准。左侧结构化智能录入，右侧 1:1 标准 A4 真实呈现。独创「一键智能卡页」算法，一键导出超清矢量 PDF。
          </p>

          <!-- 核心行动按钮组 -->
          <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <router-link
              to="/editor/demo"
              class="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-xl shadow-blue-500/25 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 group"
            >
              <Sparkles class="w-5 h-5 text-blue-200 group-hover:rotate-12 transition transform" />
              <span>立即免费制作简历</span>
              <ArrowRight class="w-4 h-4 text-blue-200 group-hover:translate-x-1 transition transform" />
            </router-link>

            <a
              href="#templates"
              class="w-full sm:w-auto px-7 py-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm sm:text-base rounded-2xl border border-slate-200 shadow-2xs hover:shadow transition flex items-center justify-center gap-2"
            >
              <LayoutTemplate class="w-4 h-4 text-slate-500" />
              <span>精选模板画廊</span>
            </a>
          </div>

          <!-- 核心保障承诺 -->
          <div class="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm font-medium text-slate-500">
            <span class="flex items-center gap-1.5"><CheckCircle2 class="w-4 h-4 text-emerald-500" /> 免注册直接体验</span>
            <span class="flex items-center gap-1.5"><CheckCircle2 class="w-4 h-4 text-emerald-500" /> 零广告 / 永久无水印</span>
            <span class="flex items-center gap-1.5"><CheckCircle2 class="w-4 h-4 text-emerald-500" /> 独家智能一键卡页</span>
            <span class="flex items-center gap-1.5"><CheckCircle2 class="w-4 h-4 text-emerald-500" /> 原生高保真矢量打印</span>
          </div>

          <!-- 产品界面效果拟态大图预览 -->
          <div class="mt-16 max-w-5xl mx-auto rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-slate-200/60 to-slate-300/40 border border-white/80 shadow-2xl shadow-slate-400/20 backdrop-blur-md">
            <div class="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-inner flex flex-col sm:flex-row h-72 sm:h-96 items-center justify-between p-6 sm:p-10 gap-8">
              <div class="text-left max-w-md">
                <span class="text-[11px] font-mono uppercase tracking-wider text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">Real-Time A4 WYSIWYG</span>
                <h3 class="text-xl sm:text-2xl font-bold text-slate-900 mt-2">真实标准 A4 画布，排版所见即所得</h3>
                <p class="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                  不再需要在 Word 里痛苦调整边距与表格。左侧录入个人经历，右侧实时按打印物理像素精准预览，彻底杜绝导出格式错乱。
                </p>
                <div class="mt-6 flex items-center gap-3">
                  <router-link
                    to="/editor/demo"
                    class="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl transition"
                  >
                    <span>体验在线编辑器</span>
                    <ChevronRight class="w-4 h-4" />
                  </router-link>
                </div>
              </div>

              <!-- 右侧拟态纸张卡片 -->
              <div class="relative w-48 sm:w-60 h-full bg-slate-50 border border-slate-200 rounded-xl shadow-lg p-3 flex flex-col justify-between overflow-hidden select-none hover:rotate-1 transition-transform duration-300">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-blue-600/20"></div>
                    <div class="space-y-1">
                      <div class="w-16 h-2.5 bg-slate-800 rounded"></div>
                      <div class="w-10 h-1.5 bg-slate-400 rounded"></div>
                    </div>
                  </div>
                  <div class="h-px bg-slate-200 my-2"></div>
                  <div class="space-y-1">
                    <div class="w-12 h-2 bg-blue-600 rounded"></div>
                    <div class="w-full h-1 bg-slate-300 rounded"></div>
                    <div class="w-5/6 h-1 bg-slate-300 rounded"></div>
                  </div>
                  <div class="space-y-1 pt-2">
                    <div class="w-12 h-2 bg-blue-600 rounded"></div>
                    <div class="w-full h-1 bg-slate-300 rounded"></div>
                    <div class="w-4/5 h-1 bg-slate-300 rounded"></div>
                  </div>
                </div>
                <div class="text-[9px] text-center text-slate-400 font-mono">1:1 Standard A4 (210×297mm)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 精选模板画廊 (Template Showcase) -->
      <section id="templates" class="py-20 bg-white border-y border-slate-200/80">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-14">
            <span class="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">Templates</span>
            <h2 class="text-3xl font-black text-slate-900 mt-3">多行业专业设计模板</h2>
            <p class="text-sm text-slate-500 mt-2">换模板绝不丢数据。经历与排版完全解耦，随时切换心仪风格</p>
          </div>

          <!-- 模板卡片网格 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div
              v-for="tmpl in TEMPLATES"
              :key="tmpl.id"
              class="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 hover:bg-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div class="flex items-center justify-between mb-3">
                  <span class="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full">
                    {{ tmpl.tag }}
                  </span>
                </div>
                <h3 class="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">{{ tmpl.name }}</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">{{ tmpl.desc }}</p>

                <div class="mt-4 pt-4 border-t border-slate-200/60 text-xs text-slate-400">
                  <span class="font-medium text-slate-600">推荐行业：</span>{{ tmpl.bestFor }}
                </div>
              </div>

              <div class="mt-6 pt-4">
                <button
                  @click="startWithTemplate(tmpl.id)"
                  class="w-full py-2.5 bg-white group-hover:bg-blue-600 text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-blue-600 rounded-xl font-semibold text-xs shadow-2xs transition flex items-center justify-center gap-1.5"
                >
                  <span>采用此模板制作</span>
                  <ArrowRight class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. 对比痛点表 (Why OpenResume) -->
      <section class="py-20 bg-slate-50">
        <div class="max-w-4xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-xl mx-auto mb-14">
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">Comparison</span>
            <h2 class="text-3xl font-black text-slate-900 mt-3">拒绝竞品套路，体验质的飞跃</h2>
            <p class="text-sm text-slate-500 mt-2">告别动辄充值 VIP 的收费限制，求职工具就该回归纯粹</p>
          </div>

          <div class="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
            <div class="grid grid-cols-12 bg-slate-100/80 px-6 py-4 text-xs font-bold text-slate-600 border-b border-slate-200">
              <div class="col-span-4">功能特性</div>
              <div class="col-span-4 text-blue-700 font-extrabold flex items-center gap-1">
                <span>OpenResume</span>
                <span class="text-[9px] bg-blue-600 text-white px-1 rounded">推荐</span>
              </div>
              <div class="col-span-4 text-slate-400">传统商业收费网站</div>
            </div>

            <div
              v-for="(comp, i) in COMPARISONS"
              :key="i"
              class="grid grid-cols-12 px-6 py-4 text-xs border-b border-slate-100 last:border-b-0 items-center hover:bg-slate-50/50 transition"
            >
              <div class="col-span-4 font-semibold text-slate-800">{{ comp.item }}</div>
              <div class="col-span-4 text-emerald-700 font-medium flex items-center gap-1.5">
                <Check class="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{{ comp.openResume }}</span>
              </div>
              <div class="col-span-4 text-slate-400 flex items-center gap-1.5">
                <X class="w-4 h-4 text-rose-400 shrink-0" />
                <span>{{ comp.others }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. 核心特性网格 (Feature Grid) -->
      <section class="py-20 bg-white border-t border-slate-200/80">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-14">
            <span class="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">Core Features</span>
            <h2 class="text-3xl font-black text-slate-900 mt-3">专注求职核心细节的创新</h2>
            <p class="text-sm text-slate-500 mt-2">每一个像素与交互，均围绕提高 HR 简历通过率设计</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div
              v-for="(f, i) in FEATURES"
              :key="i"
              class="bg-slate-50/60 p-7 rounded-3xl border border-slate-200/80 hover:bg-white hover:border-blue-200 hover:shadow-xl transition-all duration-300 group"
            >
              <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 text-blue-600 flex items-center justify-center mb-5 shadow-2xs group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition">
                <component :is="f.icon" class="w-6 h-6" />
              </div>
              <h3 class="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition">{{ f.title }}</h3>
              <p class="text-xs text-slate-500 leading-relaxed">{{ f.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 5. 常见问题 FAQ 手风琴 -->
      <section class="py-20 bg-slate-50 border-t border-slate-200/80">
        <div class="max-w-3xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-xl mx-auto mb-12">
            <span class="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full">FAQ</span>
            <h2 class="text-3xl font-black text-slate-900 mt-3">常见问题与解答</h2>
            <p class="text-sm text-slate-500 mt-2">清晰解答你在制作、排版与投递时的疑惑</p>
          </div>

          <div class="space-y-4">
            <div
              v-for="(faq, index) in FAQS"
              :key="index"
              class="border border-slate-200 rounded-2xl bg-white overflow-hidden transition shadow-2xs"
            >
              <button
                @click="toggleFaq(index)"
                class="w-full px-6 py-4 text-left flex items-center justify-between text-sm font-bold text-slate-900 hover:text-blue-600 transition select-none"
              >
                <span>{{ faq.q }}</span>
                <ChevronDown
                  class="w-4 h-4 text-slate-400 transition-transform duration-200"
                  :class="{ 'rotate-180 text-blue-600': openFaqIndex === index }"
                />
              </button>
              <div
                v-show="openFaqIndex === index"
                class="px-6 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100"
              >
                {{ faq.a }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. 底部转化横幅 CTA -->
      <section class="py-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-950 text-white relative overflow-hidden text-center">
        <div class="max-w-4xl mx-auto px-4 relative z-10">
          <h2 class="text-3xl sm:text-5xl font-black tracking-tight">现在就让你的简历焕然一新</h2>
          <p class="mt-4 text-sm sm:text-base text-blue-100 max-w-xl mx-auto">
            无需付费、无需繁琐配置，立即进入编辑器体验 1 秒排版一页纸的顺畅感受。
          </p>

          <div class="mt-8 flex justify-center">
            <router-link
              to="/editor/demo"
              class="px-8 py-4 bg-white text-blue-600 hover:bg-blue-50 font-black text-sm sm:text-base rounded-2xl shadow-xl transition transform hover:scale-105"
            >
              立即免费开始制作
            </router-link>
          </div>
        </div>
      </section>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-400">
      <div class="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs">R</span>
          <span class="font-bold text-slate-700">OpenResume</span>
          <span>· 开源现代化简历制作平台</span>
        </div>
        <p>托管于 Cloudflare 全球边缘生态 · 基于 Vue 3 & Hono 构建</p>
      </div>
    </footer>
  </div>
</template>
