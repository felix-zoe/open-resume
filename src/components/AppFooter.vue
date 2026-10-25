<script setup lang="ts">
import { computed } from 'vue';
import { BrandMark } from './ui';
import { Zap } from 'lucide-vue-next';

/**
 * 站点页脚。
 *
 * 首页与工作台共用同一份：法律链接必须处处可达（注册页与登录页也各自带一份，
 * 因为它们在弹窗/全屏表单里，没有页脚空间）。之前首页内联了一份，工作台没有，
 * 导致「从工作台找不到隐私政策」。
 */

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const year = computed(() => new Date().getFullYear());
</script>

<template>
  <footer class="border-t border-slate-200 bg-white" :class="compact ? 'py-5' : 'py-7'">
    <div
      class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500"
    >
      <div class="flex items-center gap-2">
        <BrandMark size="xs" />
        <span class="font-bold text-slate-700">OpenResume</span>
        <span class="text-slate-300" aria-hidden="true">·</span>
        <span>开源简历制作平台</span>
        <span class="text-slate-300 hidden sm:inline" aria-hidden="true">·</span>
        <span class="hidden sm:inline font-mono text-2xs">© {{ year }}</span>
      </div>

      <div class="flex items-center gap-4">
        <nav class="flex items-center gap-3" aria-label="站点导航">
          <!-- 示例库入口放在每个页面的页脚：内链让爬虫能到达，用户也能从这里找灵感 -->
          <router-link to="/examples" class="hover:text-slate-900 transition">简历示例</router-link>
          <router-link to="/privacy" class="hover:text-slate-900 transition">隐私政策</router-link>
          <router-link to="/terms" class="hover:text-slate-900 transition">服务条款</router-link>
          <a
            href="https://github.com/felix-zoe/open-resume"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-slate-900 transition"
          >
            源代码
          </a>
        </nav>
        <p class="hidden sm:flex items-center gap-1.5">
          <Zap class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>Vue 3 · Hono · Cloudflare Pages</span>
        </p>
      </div>
    </div>
  </footer>
</template>
