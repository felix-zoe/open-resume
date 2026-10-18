<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Check, Sparkles } from 'lucide-vue-next';
import AuthForm from '../components/auth/AuthForm.vue';
import { AppTabs, BrandMark } from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import type { AuthMode } from '../composables/useAuthForm';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const tabs = [
  { key: 'login', label: '账号登录' },
  { key: 'register', label: '免费注册' }
];

/** URL 是唯一事实来源：/register 与 /login 决定 Tab */
const mode = computed<AuthMode>(() => (route.name === 'Register' ? 'register' : 'login'));
const isLogin = computed(() => mode.value === 'login');

const redirectTarget = computed(() => (route.query.redirect as string) || '/dashboard');

/** Tab 点击 → 换路由（replace，避免在登录/注册间来回堆历史） */
const switchMode = (next: string) => {
  if (next === mode.value) return;
  router.replace({
    name: next === 'register' ? 'Register' : 'Login',
    query: route.query
  });
};

const handleSuccess = (payload: { migrated: boolean }) => {
  toast.success(
    payload.migrated ? '登录成功，本地草稿已同步至云端' : '账号已就绪，草稿仍安全保存在本机'
  );
  router.push(redirectTarget.value);
};

onMounted(() => {
  if (authStore.isLoggedIn) {
    router.replace(redirectTarget.value);
  }
});
</script>

<template>
  <div class="min-h-screen flex bg-white font-sans text-slate-800">
    <!-- 左侧：品牌价值展示（大屏可见） -->
    <aside
      class="hidden lg:flex lg:w-1/2 bg-slate-950 text-white flex-col justify-between p-12 relative overflow-hidden select-none"
      aria-label="产品介绍"
    >
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-primary-500/15 rounded-full blur-3xl" />

      <router-link to="/" class="relative z-10 inline-flex items-center gap-2.5 w-fit">
        <BrandMark size="lg" class="!rounded-xl" />
        <span class="text-xl font-black tracking-tight">OpenResume</span>
      </router-link>

      <div class="relative z-10 max-w-lg space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary-200 text-xs font-semibold">
          <Sparkles class="w-3.5 h-3.5" />
          <span>开源 · 无水印 · 数据归你</span>
        </div>

        <h2 class="text-3xl sm:text-4xl font-black leading-tight">
          让每一次经历呈现，<br />
          都配得上你的专业与付出
        </h2>

        <p class="text-sm text-slate-400 leading-relaxed">
          真实 A4 排版、一键压缩到一页、在线只读分享。简历保存在你自己的云端空间，随时导出 PDF。
        </p>

        <ul class="space-y-3 pt-4">
          <li v-for="item in [
            '所见即所得的 A4 排版，导出与预览一致',
            '多份简历分别管理，针对不同岗位投递',
            '在线只读链接，HR 打开即看无需登录'
          ]" :key="item" class="flex items-center gap-3 text-xs text-slate-300">
            <span class="w-5 h-5 rounded-full bg-success-500/20 text-success-600 flex items-center justify-center shrink-0">
              <Check class="w-3 h-3" />
            </span>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>

      <div class="relative z-10 text-xs text-slate-400 flex items-center justify-between">
        <span>© 2026 OpenResume</span>
        <span>开源云原生架构</span>
      </div>
    </aside>

    <!-- 右侧：认证表单 -->
    <main id="main-content" tabindex="-1" class="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16">
      <div class="flex items-center justify-between">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft class="w-4 h-4" aria-hidden="true" />
          <span>返回首页</span>
        </router-link>

        <div class="lg:hidden flex items-center gap-2">
          <BrandMark size="sm" />
          <span class="font-extrabold text-sm text-slate-900">OpenResume</span>
        </div>
      </div>

      <div class="max-w-sm w-full mx-auto my-auto py-8">
        <AppTabs
          :model-value="mode"
          :tabs="tabs"
          block
          aria-label="登录或注册"
          class="mb-6"
          @update:model-value="switchMode"
        />

        <h1 class="text-2xl font-black text-slate-900">
          {{ isLogin ? '登录您的账户' : '创建免费账户' }}
        </h1>
        <p class="text-xs text-slate-500 mt-1 mb-6">
          {{ isLogin ? '输入凭证即可同步云端简历与投递看板' : '注册后可保存多份简历并生成在线只读链接' }}
        </p>

        <AuthForm :mode="mode" @success="handleSuccess" />
      </div>

      <p class="text-center text-2xs text-slate-500">
        登录或注册即代表您同意 OpenResume 开源服务协议与隐私声明
      </p>
    </main>
  </div>
</template>
