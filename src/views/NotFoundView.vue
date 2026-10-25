<script setup lang="ts">
import { useRoute } from 'vue-router';
import { Compass, ArrowLeft, Home } from 'lucide-vue-next';

const route = useRoute();
</script>

<template>
  <main id="main-content" tabindex="-1" class="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
    <div class="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-400 mb-5">
      <Compass class="w-7 h-7" />
    </div>

    <p class="text-xs font-mono font-semibold text-slate-500 tracking-widest">404</p>
    <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mt-2">这个页面不存在</h1>
    <p class="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
      地址 <code class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">{{ route.fullPath }}</code>
      没有对应内容，可能是链接已失效或输入有误。
    </p>

    <div class="flex items-center gap-3 mt-7">
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition"
      >
        <Home class="w-3.5 h-3.5" />
        <span>返回首页</span>
      </router-link>
      <router-link
        to="/editor/new"
        class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 hover:border-slate-300 bg-white transition"
      >
        <ArrowLeft class="w-3.5 h-3.5" />
        <span>开始制作简历</span>
      </router-link>
    </div>
  </main>
</template>
