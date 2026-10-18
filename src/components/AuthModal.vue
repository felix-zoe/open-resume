<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AppModal, AppTabs } from './ui';
import AuthForm from './auth/AuthForm.vue';
import { useToast } from '../composables/useToast';
import type { AuthMode } from '../composables/useAuthForm';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const toast = useToast();

const mode = ref<AuthMode>('login');

const tabs = [
  { key: 'login', label: '账号登录' },
  { key: 'register', label: '免费注册' }
];

const isLogin = computed(() => mode.value === 'login');

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});

// 每次重新打开都回到登录 Tab，避免上次注册态残留
watch(
  () => props.isOpen,
  (value) => {
    if (value) mode.value = 'login';
  }
);

const handleSuccess = (payload: { migrated: boolean }) => {
  toast.success(
    payload.migrated ? '账号已就绪，本地草稿已同步至云端' : '账号已就绪，草稿仍安全保存在本机'
  );
  emit('success');
  emit('close');
};
</script>

<template>
  <AppModal v-model:open="open" size="sm" :title="isLogin ? '欢迎回到 OpenResume' : '创建你的免费账户'">
    <template #header>
      <h2 class="text-base font-bold text-slate-900">
        {{ isLogin ? '欢迎回到 OpenResume' : '创建你的免费账户' }}
      </h2>
      <p class="text-2xs text-slate-500 mt-1">
        {{ isLogin ? '登录同步多份简历与投递足迹' : '免费创建账号，随时切换模板' }}
      </p>
    </template>

    <AppTabs
      :model-value="mode"
      :tabs="tabs"
      block
      aria-label="登录或注册"
      class="mb-4"
      @update:model-value="mode = $event as AuthMode"
    />

    <AuthForm :mode="mode" dense @success="handleSuccess" />
  </AppModal>
</template>
