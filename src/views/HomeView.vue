<script setup lang="ts">
import Navbar from '../components/Navbar.vue';
import { Sparkles, Download, CheckCircle, ShieldCheck, Zap, Sliders } from 'lucide-vue-next';

const FEATURES = [
  {
    icon: Sparkles,
    title: '所见即所得 A4 排版',
    desc: '左侧结构化表单录入，右侧 1:1 标准 A4 真实比例画布即时渲染，支持动态跨页标线提示。'
  },
  {
    icon: Sliders,
    title: '一页纸排版优化神器',
    desc: '自研段落与模块间距自适应微调滑块，经历较少可一键饱满填满，经历较多可一键紧缩防超页。'
  },
  {
    icon: Download,
    title: '无水印矢量 PDF 导出',
    desc: '告别竞品导出收费与低清图片截屏。基于浏览器原生打印引擎，文字可选中、超链接可点击跳转。'
  },
  {
    icon: Zap,
    title: 'Cloudflare 边缘加速',
    desc: '基于 Cloudflare Pages + Workers + D1 + R2 构建，全球 Anycast 边缘毫秒级响应，数据安全可靠。'
  },
  {
    icon: ShieldCheck,
    title: '数据与视图彻底解耦',
    desc: '随意切换经典商务型、极简极客型与现代双栏型模板，换模板 100% 保持个人经历数据完整。'
  },
  {
    icon: CheckCircle,
    title: '内置 STAR 法则引导',
    desc: '遵循大厂求职黄金标准，内置 Situation/Task/Action/Result 句式引导与资深研发范文。'
  }
];
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <Navbar />

    <!-- Hero 区域 -->
    <main class="flex-1">
      <section class="max-w-5xl mx-auto px-4 pt-16 pb-20 text-center">
        <!-- 标签徽章 -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6 shadow-2xs">
          <span class="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>全新上线 · 纯粹、优雅、永久免费的求职简历工具</span>
        </div>

        <h1 class="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight">
          制作专业求职简历，<br />
          <span class="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
            本该如此简单且完全免费
          </span>
        </h1>

        <p class="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          对标国内一线平台排版水准。支持左侧结构化编辑、右侧真实 A4 预览、STAR 经历提炼与一页纸微调，一键导出无水印超清矢量 PDF。
        </p>

        <!-- CTA 按钮组 -->
        <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <router-link
            to="/editor/demo"
            class="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-500/25 transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <Sparkles class="w-5 h-5" />
            <span>立即免费制作简历</span>
          </router-link>

          <a
            href="https://github.com"
            target="_blank"
            class="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm sm:text-base rounded-2xl border border-slate-200 transition shadow-2xs flex items-center justify-center gap-2"
          >
            <span>GitHub 开源仓库</span>
          </a>
        </div>

        <!-- 痛点对比提示条 -->
        <div class="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
          <span class="flex items-center gap-1.5"><CheckCircle class="w-4 h-4 text-emerald-500" /> 无需强制注册即可体验</span>
          <span class="flex items-center gap-1.5"><CheckCircle class="w-4 h-4 text-emerald-500" /> 零广告 / 零导出水印</span>
          <span class="flex items-center gap-1.5"><CheckCircle class="w-4 h-4 text-emerald-500" /> 高保真矢量排版</span>
          <span class="flex items-center gap-1.5"><CheckCircle class="w-4 h-4 text-emerald-500" /> 部署于 Cloudflare 边缘生态</span>
        </div>
      </section>

      <!-- 特性网格 -->
      <section class="max-w-6xl mx-auto px-4 py-16 border-t border-slate-200/60">
        <div class="text-center max-w-xl mx-auto mb-12">
          <h2 class="text-2xl font-bold text-slate-900">为求职者量身定制的打磨体验</h2>
          <p class="text-xs text-slate-500 mt-2">告别笨重庞大的 Word 格式错乱，用现代 Web 体验专注内容打造</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(f, i) in FEATURES"
            :key="i"
            class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition group"
          >
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <component :is="f.icon" class="w-5 h-5" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 mb-2">{{ f.title }}</h3>
            <p class="text-xs text-slate-500 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </section>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-400">
      <p>OpenResume · 基于 Vue 3 & Cloudflare 边缘免费计划构建 · 专为高效求职打造</p>
    </footer>
  </div>
</template>
