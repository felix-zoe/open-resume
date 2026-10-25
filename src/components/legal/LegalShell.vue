<script setup lang="ts">
import Navbar from '../Navbar.vue';
import { ArrowLeft, FileText } from 'lucide-vue-next';

/**
 * 法律页面外壳。
 *
 * 隐私政策与服务条款结构完全一致（标题 + 生效日期 + 分节正文），
 * 差异只在内容。抽外壳是为了保证两页的排版、导航与返回入口不会各写一套。
 */

withDefaults(
  defineProps<{
    title: string;
    /** 生效日期，与文档正文里的日期保持一致 */
    updatedAt: string;
    summary: string;
  }>(),
  {}
);

/** 目录锚点：分节 id 由调用方用 `id` 属性提供，这里只负责跳转样式 */
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
    <Navbar />

    <main id="main-content" tabindex="-1" class="flex-1 w-full">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft class="w-3.5 h-3.5" aria-hidden="true" />
          <span>返回首页</span>
        </router-link>

        <header class="mt-5 pb-6 border-b border-slate-200">
          <div class="flex items-center gap-2 text-primary-600">
            <FileText class="w-4 h-4" aria-hidden="true" />
            <span class="text-2xs font-semibold tracking-wide uppercase">OpenResume</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-950 mt-2">{{ title }}</h1>
          <p class="text-xs text-slate-500 mt-2 leading-relaxed">{{ summary }}</p>
          <p class="text-2xs text-slate-500 mt-3 font-mono">生效日期：{{ updatedAt }}</p>
        </header>

        <article class="legal-doc mt-8 space-y-8">
          <slot />
        </article>

        <nav class="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <router-link
            to="/privacy"
            class="font-semibold text-slate-600 hover:text-primary-600 transition"
            :aria-current="$route.name === 'Privacy' ? 'page' : undefined"
          >
            隐私政策
          </router-link>
          <span class="text-slate-300" aria-hidden="true">·</span>
          <router-link
            to="/terms"
            class="font-semibold text-slate-600 hover:text-primary-600 transition"
            :aria-current="$route.name === 'Terms' ? 'page' : undefined"
          >
            服务条款
          </router-link>
          <span class="text-slate-300" aria-hidden="true">·</span>
          <a
            href="https://github.com/felix-zoe/open-resume"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-slate-600 hover:text-primary-600 transition"
          >
            源代码
          </a>
        </nav>
      </div>
    </main>
  </div>
</template>

<style scoped>
/*
  正文排版：只在本页生效，避免污染全局。
  `:deep` 是因为分节由调用方写在默认插槽里，scoped 属性落不到它们的子元素上。
*/
.legal-doc :deep(h2) {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.legal-doc :deep(section) {
  scroll-margin-top: 5rem;
}

.legal-doc :deep(p),
.legal-doc :deep(li) {
  font-size: 0.75rem;
  line-height: 1.85;
  color: #475569;
}

.legal-doc :deep(p + p) {
  margin-top: 0.5rem;
}

.legal-doc :deep(ul) {
  list-style: disc;
  padding-left: 1.15rem;
  margin-top: 0.4rem;
}

.legal-doc :deep(li + li) {
  margin-top: 0.25rem;
}

.legal-doc :deep(strong) {
  color: #1e293b;
  font-weight: 600;
}

.legal-doc :deep(a) {
  color: var(--color-primary-600, #2563eb);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
