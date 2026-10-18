<script setup lang="ts">
import { computed } from 'vue';
import { Mail, Lock, User, Eye, EyeOff, Sparkles } from 'lucide-vue-next';
import { useAuthForm, type AuthMode } from '../../composables/useAuthForm';
import { AppButton, AppInput, FormField } from '../ui';

const props = withDefaults(
  defineProps<{
    mode: AuthMode;
    /** 紧凑模式用于弹窗，宽松模式用于整页 */
    dense?: boolean;
    submitLabel?: string;
  }>(),
  { dense: false, submitLabel: undefined }
);

const emit = defineEmits<{
  (e: 'success', payload: { migrated: boolean }): void;
}>();

const {
  email,
  password,
  nickname,
  showPassword,
  loading,
  errorMsg,
  emailTouched,
  isEmailValid,
  passwordStrength,
  submit
} = useAuthForm({
  mode: () => props.mode,
  onSuccess: (result) => emit('success', { migrated: result.migrated })
});

const isRegister = computed(() => props.mode === 'register');
const emailError = computed(() =>
  emailTouched.value && !isEmailValid.value ? '请输入合规的电子邮箱格式' : undefined
);
const label = computed(
  () => props.submitLabel ?? (isRegister.value ? '创建免费账号' : '立即登录')
);

const handleSubmit = () => {
  void submit();
};
</script>

<template>
  <form :class="dense ? 'space-y-3' : 'space-y-4'" novalidate @submit.prevent="handleSubmit">
    <div
      v-if="errorMsg"
      class="p-3 bg-danger-50 text-danger-700 border border-danger-100 rounded-lg text-xs font-medium flex items-start gap-2"
      role="alert"
    >
      <span class="leading-relaxed">{{ errorMsg }}</span>
    </div>

    <FormField v-if="isRegister" label="您的昵称" id="auth-nickname">
      <template #default="{ id, describedBy }">
        <div class="relative">
          <User class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <AppInput
            :id="id"
            v-model="nickname"
            has-leading
            placeholder="如：极客小凡"
            autocomplete="nickname"
            :aria-describedby="describedBy"
          />
        </div>
      </template>
    </FormField>

    <FormField label="电子邮箱" id="auth-email" required :error="emailError">
      <template #default="{ id, describedBy, invalid }">
        <div class="relative">
          <Mail class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <AppInput
            :id="id"
            v-model="email"
            type="email"
            has-leading
            placeholder="name@example.com"
            autocomplete="email"
            inputmode="email"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @blur="emailTouched = true"
          />
        </div>
      </template>
    </FormField>

    <FormField
      label="登录密码"
      id="auth-password"
      required
      :hint="isRegister ? '至少 6 位，建议包含字母与数字' : undefined"
    >
      <template #default="{ id, describedBy }">
        <div class="relative">
          <Lock class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <AppInput
            :id="id"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            has-leading
            has-trailing
            placeholder="至少 6 位字符"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            :aria-describedby="describedBy"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 transition"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <component :is="showPassword ? EyeOff : Eye" class="w-3.5 h-3.5" />
          </button>
        </div>
      </template>
    </FormField>

    <!-- 注册时显示密码强度 -->
    <div v-if="isRegister && password" class="flex items-center gap-2 -mt-1">
      <div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="passwordStrength.color"
          :style="{ width: passwordStrength.width }"
        />
      </div>
      <span class="text-2xs font-semibold" :class="passwordStrength.textClass">
        {{ passwordStrength.label }}
      </span>
    </div>

    <AppButton
      type="submit"
      size="lg"
      block
      :loading="loading"
      :class="dense ? 'mt-1' : 'mt-2'"
    >
      <template #icon>
        <Sparkles class="w-4 h-4" aria-hidden="true" />
      </template>
      <span>{{ label }}</span>
    </AppButton>

    <p class="text-2xs text-slate-500 text-center leading-relaxed">
      登录状态保持 7 天 · 密码经 PBKDF2 加盐存储
    </p>
  </form>
</template>
