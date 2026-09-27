<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useResumeStore } from '../stores/resume';
import { X, Mail, Lock, User, Sparkles, Loader2 } from 'lucide-vue-next';

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
const loading = ref(false);
const errorMsg = ref('');

const handleSubmit = async () => {
  errorMsg.value = '';
  if (!email.value || !password.value) {
    errorMsg.value = '请填写邮箱和密码';
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

    // 如果当前处于本地草稿状态，自动创建并同步至云端
    if (resumeStore.id === 'local-draft') {
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
    }

    emit('success');
    emit('close');
  } catch (err: any) {
    errorMsg.value = err.message || '网络连接异常，请重试';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto no-print flex items-center justify-center p-4">
    <div @click="emit('close')" class="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"></div>

    <div class="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl z-10">
      <!-- 头部与关闭 -->
      <div class="flex items-center justify-between pb-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">R</div>
          <h3 class="text-sm font-bold text-gray-900">
            {{ isLoginMode ? '登录 OpenResume' : '免费注册账号' }}
          </h3>
        </div>
        <button @click="emit('close')" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 提示文案 -->
      <p class="text-xs text-gray-500 mb-4">
        {{ isLoginMode ? '登录后即可将简历多端同步至 Cloudflare D1 边缘云端' : '开启零成本云端多简历管理与无水印高清导出' }}
      </p>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="mb-3 p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs">
        {{ errorMsg }}
      </div>

      <!-- 表单输入 -->
      <form @submit.prevent="handleSubmit" class="space-y-3">
        <div v-if="!isLoginMode">
          <label class="block text-[11px] font-medium text-gray-600 mb-1">用户昵称</label>
          <div class="relative">
            <User class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              v-model="nickname"
              placeholder="怎么称呼您"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-600 mb-1">电子邮箱 *</label>
          <div class="relative">
            <Mail class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="email"
              v-model="email"
              required
              placeholder="name@example.com"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-600 mb-1">登录密码 *</label>
          <div class="relative">
            <Lock class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="password"
              v-model="password"
              required
              minlength="6"
              placeholder="至少 6 位字符"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <!-- 提交按钮 -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4" />
          <span>{{ isLoginMode ? '立即登录' : '立即注册' }}</span>
        </button>
      </form>

      <!-- 底部切换登录/注册模式 -->
      <div class="mt-4 pt-3 border-t border-gray-100 text-center">
        <button
          @click="isLoginMode = !isLoginMode; errorMsg = ''"
          class="text-xs text-blue-600 hover:underline font-medium"
        >
          {{ isLoginMode ? '没有账号？立即免费注册' : '已有账号？返回登录' }}
        </button>
      </div>
    </div>
  </div>
</template>
