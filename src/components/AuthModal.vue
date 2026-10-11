<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useResumeStore } from '../stores/resume';
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  AlertCircle
} from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const authStore = useAuthStore();
const resumeStore = useResumeStore();

const isLoginMode = ref(true);
const email = ref('');
const password = ref('');
const nickname = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
const loading = ref(false);
const errorMsg = ref('');
const successToast = ref('');
const emailTouched = ref(false);

// 邮箱格式实时校验
const isEmailValid = computed(() => {
  if (!email.value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
});

// 密码强度动态计算 (0: 无, 1: 弱, 2: 中, 3: 强)
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
  alert('为保障纯粹开源与数据私密，若遗忘密码可直接注册新账号，或联系系统管理员通过 D1 数据库快速重置凭证。');
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
  const endpoint = isLoginMode.value ? '/api/auth/login' : '/api/auth/register';
  const payload = isLoginMode.value
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

    // 如果处于本地草稿编辑状态，自动将本地成果平滑同步至 Cloudflare D1
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
        console.error('自动同步草稿失败:', syncErr);
      }
    }

    successToast.value = isLoginMode.value ? '登录成功！正在进入...' : '注册成功！已开启云端漫游！';
    setTimeout(() => {
      emit('success');
      emit('close');
      successToast.value = '';
    }, 600);
  } catch (err: any) {
    errorMsg.value = err.message || '网络连接异常，请重试';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto no-print flex items-center justify-center p-4">
    <!-- 背景遮罩 -->
    <div @click="emit('close')" class="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"></div>

    <div class="relative bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl z-10 border border-slate-200/80 overflow-hidden">
      <!-- 顶部装饰光条 -->
      <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400"></div>

      <!-- 头部与关闭 -->
      <div class="flex items-center justify-between pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/20">
            R
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">
              {{ isLoginMode ? '欢迎回到 OpenResume' : '创建你的免费账户' }}
            </h3>
            <p class="text-[11px] text-slate-400">
              {{ isLoginMode ? '登录同步多份简历与 HR 投递足迹' : '永久无水印 · 毫秒级多端云同步' }}
            </p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 成功/错误提示气泡 -->
      <div v-if="successToast" class="my-3 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
        <span>{{ successToast }}</span>
      </div>

      <div v-if="errorMsg" class="my-3 p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2">
        <AlertCircle class="w-4 h-4 text-rose-500 shrink-0" />
        <span>{{ errorMsg }}</span>
      </div>

      <!-- 表单输入 -->
      <form @submit.prevent="handleSubmit" class="space-y-3.5 mt-4">
        <!-- 注册时的昵称输入 -->
        <div v-if="!isLoginMode">
          <label class="block text-[11px] font-bold text-slate-700 mb-1">您的昵称</label>
          <div class="relative">
            <User class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              v-model="nickname"
              placeholder="如：极客小凡 / 招聘官张先生"
              class="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
          </div>
        </div>

        <!-- 电子邮箱 -->
        <div>
          <label class="block text-[11px] font-bold text-slate-700 mb-1">电子邮箱 *</label>
          <div class="relative">
            <Mail class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="email"
              v-model="email"
              required
              @blur="emailTouched = true"
              placeholder="name@example.com"
              class="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              :class="emailTouched && !isEmailValid ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'"
            />
          </div>
          <p v-if="emailTouched && !isEmailValid" class="mt-1 text-[10px] text-rose-500 font-medium">
            请输入合规的电子邮箱格式
          </p>
        </div>

        <!-- 登录密码 (带明/密文切换) -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-[11px] font-bold text-slate-700">登录密码 *</label>
            <button
              v-if="isLoginMode"
              type="button"
              @click="handleForgot"
              class="text-[10px] text-blue-600 hover:underline cursor-pointer"
            >
              忘记密码？
            </button>
          </div>
          <div class="relative">
            <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="password"
              required
              minlength="6"
              placeholder="至少 6 位字符"
              class="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="切换密码可见性"
            >
              <component :is="showPassword ? EyeOff : Eye" class="w-4 h-4" />
            </button>
          </div>

          <!-- 注册时的密码强度动态指示计 -->
          <div v-if="!isLoginMode && password" class="mt-2">
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

        <!-- 记住我勾选 -->
        <div class="flex items-center justify-between pt-1">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              v-model="rememberMe"
              class="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600 cursor-pointer"
            />
            <span class="text-[11px] text-slate-500">保持登录状态 (7天)</span>
          </label>
          <span class="text-[10px] text-slate-400 flex items-center gap-1">
            <ShieldCheck class="w-3 h-3 text-emerald-500" />
            <span>端到端加密</span>
          </span>
        </div>

        <!-- 提交按钮 -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full mt-3 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4 text-blue-200" />
          <span>{{ isLoginMode ? '立即登录' : '免费创建账户' }}</span>
        </button>
      </form>

      <!-- 底部模式切换按钮 -->
      <div class="mt-5 pt-3.5 border-t border-slate-100 text-center">
        <button
          type="button"
          @click="isLoginMode = !isLoginMode; errorMsg = ''"
          class="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
        >
          {{ isLoginMode ? '还没有账号？点击免费注册体验' : '已有账号？返回直接登录' }}
        </button>
      </div>
    </div>
  </div>
</template>
