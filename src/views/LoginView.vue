<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useResumeStore } from '../stores/resume';
import {
  Mail,
  Lock,
  User,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Check
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const resumeStore = useResumeStore();

// 模式：登录 / 注册
const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const nickname = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
const loading = ref(false);
const errorMsg = ref('');
const successToast = ref('');
const emailTouched = ref(false);

onMounted(() => {
  // 根据 URL query 参数或路径预选 Tab
  if (route.query.mode === 'register' || route.path.includes('register')) {
    mode.value = 'register';
  }
  // 若已登录直接去往 dashboard
  if (authStore.isLoggedIn) {
    router.push('/dashboard');
  }
});

// 邮箱校验
const isEmailValid = computed(() => {
  if (!email.value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
});

// 密码强度
const passwordStrength = computed(() => {
  const val = password.value;
  if (!val) return { score: 0, label: '', width: '0%', color: 'bg-slate-200', textClass: 'text-slate-400' };
  let score = 0;
  if (val.length >= 6) score++;
  if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val)) score++;
  if (val.length >= 10 || /[^A-Za-z0-9]/.test(val)) score++;

  if (score === 1) return { score: 1, label: '弱', width: '33%', color: 'bg-rose-500', textClass: 'text-rose-500' };
  if (score === 2) return { score: 2, label: '中等', width: '66%', color: 'bg-amber-500', textClass: 'text-amber-500' };
  return { score: 3, label: '强', width: '100%', color: 'bg-emerald-500', textClass: 'text-emerald-500' };
});

const handleForgot = () => {
  alert('为保障纯粹开源与数据私密，若遗忘密码可直接注册新账号，或联系系统管理员通过 D1 数据库重置凭证。');
};

const handleSubmit = async () => {
  errorMsg.value = '';
  if (!email.value || !password.value) {
    errorMsg.value = '请完整填写邮箱与密码';
    return;
  }

  if (!isEmailValid.value) {
    errorMsg.value = '请输入合规的电子邮箱地址';
    return;
  }

  if (password.value.length < 6) {
    errorMsg.value = '密码长度至少需为 6 位字符';
    return;
  }

  loading.value = true;
  const isLogin = mode.value === 'login';
  const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
  const payload = isLogin
    ? { email: email.value, password: password.value }
    : { email: email.value, password: password.value, nickname: nickname.value };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data: any = await res.json();
    if (!res.ok || data.code !== 0) {
      throw new Error(data.message || '操作失败，请重试');
    }

    // 存储 Token 与用户信息
    authStore.setAuth(data.data.token, data.data.user);

    // 自动将本地草稿无缝漫游至云端
    if (resumeStore.id === 'local-draft' || resumeStore.id === 'demo') {
      try {
        const createRes = await fetch('/api/resumes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.data.token}`
          },
          body: JSON.stringify({
            title: resumeStore.title,
            templateId: resumeStore.templateId,
            content: resumeStore.content,
            themeConfig: resumeStore.themeConfig
          })
        });
        const createData: any = await createRes.json();
        if (createData.code === 0 && createData.data?.id) {
          resumeStore.id = createData.data.id;
        }
      } catch (syncErr) {
        console.error('自动漫游草稿失败:', syncErr);
      }
    }

    successToast.value = isLogin ? '登录成功！即将进入工作台...' : '注册成功！欢迎开启 OpenResume！';

    setTimeout(() => {
      const redirect = route.query.redirect as string;
      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    }, 600);
  } catch (err: any) {
    errorMsg.value = err.message || '网络连接异常，请重试';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex bg-white font-sans text-slate-800">
    <!-- 左侧：品牌价值展示分栏 (大屏可见) -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex-col justify-between p-12 relative overflow-hidden select-none">
      <!-- 背景光晕装饰 -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>

      <!-- 品牌标识 -->
      <div class="relative z-10">
        <router-link to="/" class="inline-flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-black text-base shadow-lg shadow-blue-500/30">
            R
          </div>
          <span class="text-xl font-black tracking-tight text-white">OpenResume</span>
        </router-link>
      </div>

      <!-- 核心价值标语与特性 -->
      <div class="relative z-10 max-w-lg space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold">
          <Sparkles class="w-3.5 h-3.5 text-blue-400" />
          <span>全新上线 · 商业级无水印求职简历平台</span>
        </div>

        <h2 class="text-3xl sm:text-4xl font-black leading-tight text-white">
          让每一次经历呈现，<br />
          都配得上你的专业与付出
        </h2>

        <p class="text-sm text-slate-400 leading-relaxed">
          告别导出收费与格式错乱。OpenResume 提供真实 A4 矢量排版、独创一键智能卡页与 HR 阅读足迹追踪，开启云端自由漫游。
        </p>

        <!-- 特性列表 -->
        <div class="space-y-3 pt-4">
          <div class="flex items-center gap-3 text-xs text-slate-300">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check class="w-3 h-3" />
            </div>
            <span>独家 Auto-Fit 智能卡页算法，1 秒告别难看超页</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-300">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check class="w-3 h-3" />
            </div>
            <span>HR 在线阅读停留时长与下载行为实时追踪看板</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-300">
            <div class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check class="w-3 h-3" />
            </div>
            <span>依托 Cloudflare 全球分布式边缘存储，数据安全私密</span>
          </div>
        </div>
      </div>

      <!-- 底部版权与声明 -->
      <div class="relative z-10 text-xs text-slate-500 flex items-center justify-between">
        <span>© 2026 OpenResume</span>
        <span>开源云原生架构</span>
      </div>
    </div>

    <!-- 右侧：认证表单区域 -->
    <div class="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16">
      <!-- 顶部返回 -->
      <div class="flex items-center justify-between">
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>返回首页</span>
        </router-link>

        <div class="lg:hidden flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">R</div>
          <span class="font-extrabold text-sm text-slate-900">OpenResume</span>
        </div>
      </div>

      <!-- 中间卡片表单 -->
      <div class="max-w-sm w-full mx-auto my-auto py-8">
        <!-- Tab 切换 -->
        <div class="flex items-center p-1 bg-slate-100 rounded-2xl mb-6">
          <button
            type="button"
            @click="mode = 'login'; errorMsg = ''"
            class="flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer"
            :class="mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'"
          >
            账号登录
          </button>
          <button
            type="button"
            @click="mode = 'register'; errorMsg = ''"
            class="flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer"
            :class="mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'"
          >
            免费注册
          </button>
        </div>

        <div>
          <h1 class="text-2xl font-black text-slate-900">
            {{ mode === 'login' ? '登录您的账户' : '开启极简简历制作之旅' }}
          </h1>
          <p class="text-xs text-slate-500 mt-1">
            {{ mode === 'login' ? '输入凭证即可同步云端简历与求职看板' : '免费创建账号，永久享有无水印导出与多模板切换' }}
          </p>
        </div>

        <!-- 成功/错误反馈 -->
        <div v-if="successToast" class="my-4 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{{ successToast }}</span>
        </div>

        <div v-if="errorMsg" class="my-4 p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle class="w-4 h-4 text-rose-500 shrink-0" />
          <span>{{ errorMsg }}</span>
        </div>

        <!-- 表单 -->
        <form @submit.prevent="handleSubmit" class="space-y-4 mt-6">
          <!-- 昵称 (仅注册) -->
          <div v-if="mode === 'register'">
            <label class="block text-xs font-bold text-slate-700 mb-1.5">您的昵称</label>
            <div class="relative">
              <User class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                v-model="nickname"
                placeholder="如：资深求职者"
                class="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
            </div>
          </div>

          <!-- 邮箱 -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">电子邮箱 *</label>
            <div class="relative">
              <Mail class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                v-model="email"
                required
                @blur="emailTouched = true"
                placeholder="name@example.com"
                class="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                :class="emailTouched && !isEmailValid ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'"
              />
            </div>
            <p v-if="emailTouched && !isEmailValid" class="mt-1 text-[10px] text-rose-500 font-medium">
              请输入合规的电子邮箱格式
            </p>
          </div>

          <!-- 密码 (带眼睛切换) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-slate-700">登录密码 *</label>
              <button
                v-if="mode === 'login'"
                type="button"
                @click="handleForgot"
                class="text-[11px] text-blue-600 hover:underline cursor-pointer"
              >
                忘记密码？
              </button>
            </div>
            <div class="relative">
              <Lock class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                required
                minlength="6"
                placeholder="至少 6 位字符"
                class="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="切换密码可见性"
              >
                <component :is="showPassword ? EyeOff : Eye" class="w-4 h-4" />
              </button>
            </div>

            <!-- 注册时的密码强度动态指示计 -->
            <div v-if="mode === 'register' && password" class="mt-2.5">
              <div class="flex items-center justify-between text-[10px] mb-1">
                <span class="text-slate-400">密码强度:</span>
                <span :class="passwordStrength.textClass" class="font-bold">{{ passwordStrength.label }}</span>
              </div>
              <div class="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full transition-all duration-300 rounded-full"
                  :class="passwordStrength.color"
                  :style="{ width: passwordStrength.width }"
                ></div>
              </div>
            </div>
          </div>

          <!-- 记住我 -->
          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="rememberMe"
                class="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600 cursor-pointer"
              />
              <span class="text-xs text-slate-500">保持登录状态 (7天)</span>
            </label>
            <span class="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
              <span>D1 边缘加密</span>
            </span>
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full mt-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            <Sparkles v-else class="w-4 h-4 text-blue-200" />
            <span>{{ mode === 'login' ? '立即登录' : '创建免费账号' }}</span>
          </button>
        </form>
      </div>

      <!-- 底部版权 -->
      <div class="text-center text-xs text-slate-400">
        登录或注册即代表您同意 OpenResume 开源服务协议与隐私声明
      </div>
    </div>
  </div>
</template>
