<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AlertTriangle, Download, KeyRound, ShieldCheck, Sparkles, Trash2, User } from 'lucide-vue-next';
import Navbar from '../components/Navbar.vue';
import AppFooter from '../components/AppFooter.vue';
import AiProviderForm from '../components/ai/AiProviderForm.vue';
import { AppButton, AppCard, AppInput, FormField } from '../components/ui';
import { useAuthStore } from '../stores/auth';
import { useAccount } from '../composables/useAccount';
import { useToast } from '../composables/useToast';
import { askConfirm } from '../composables/useConfirm';
import { apiFetch } from '../utils/http';
import { applyPageMeta } from '../utils/seo';
import { loadAiConfig, saveAiConfig, type AiConfig } from '../utils/aiConfig';

/**
 * 账号设置（T5.5、T5.7）。
 *
 * 危险程度递增：改密码（日常）→ 导出数据（安心）→ 注销（不可逆）。
 * 注销放在最下面并单独用危险色边框：它不是「又一个设置项」，
 * 而是「把这里所有东西都删掉」的入口。
 *
 * AI 配置也放这里：它是「我这台浏览器上装了哪些外来服务」的一部分，
 * 与登录态无关，登录用户在这里管理最顺手（游客仍可在编辑器抽屉里配）。
 */
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const { isSubmitting, changePassword, downloadExport, requestDeletion, cancelDeletion } = useAccount();

const aiConfig = ref<AiConfig>(loadAiConfig());
watch(aiConfig, (next) => saveAiConfig(next), { deep: true });

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const isChangingPassword = ref(false);

const deletionDaysLeft = ref<number | null>(null);
const deletionRequestedAt = ref<number | null>(null);
const confirmEmail = ref('');
const isDeleting = ref(false);

const email = computed(() => authStore.user?.email ?? '');
const canSubmitPassword = computed(
  () => currentPassword.value.length > 0 && newPassword.value.length > 0 && !isChangingPassword.value
);

onMounted(async () => {
  applyPageMeta({ title: '账号设置', path: '/settings', indexable: false });

  if (!authStore.isLoggedIn) {
    router.replace({ name: 'Login', query: { redirect: '/settings' } });
    return;
  }

  // 拉一次最新状态：注销冷静期可能在别的设备上申请过
  const result = await apiFetch<{ deletionRequestedAt: number | null; deletionDaysLeft: number | null }>(
    '/api/auth/me'
  );
  if (result.ok && result.data) {
    deletionRequestedAt.value = result.data.deletionRequestedAt ?? null;
    deletionDaysLeft.value = result.data.deletionDaysLeft ?? null;
  }
});

async function handleChangePassword() {
  passwordError.value = '';

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致';
    return;
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少 6 位';
    return;
  }

  isChangingPassword.value = true;
  try {
    const result = await changePassword(currentPassword.value, newPassword.value);
    if (!result.ok) {
      passwordError.value = result.message || '修改失败，请稍后重试';
      return;
    }
    toast.success('密码已更新，下次登录请使用新密码');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } finally {
    isChangingPassword.value = false;
  }
}

async function handleExport() {
  const result = await downloadExport();
  if (result.ok) toast.success('数据已导出为 JSON 文件');
  else toast.error(result.message);
}

async function handleRequestDeletion() {
  if (confirmEmail.value.trim().toLowerCase() !== email.value.toLowerCase()) {
    toast.error('请输入完整账号邮箱以确认注销');
    return;
  }

  const confirmed = await askConfirm({
    title: '确认注销账号？',
    description: '7 天内登录即可撤销；到期后简历、版本历史、分享链接与投递记录将被永久删除。',
    confirmText: '提交注销申请',
    tone: 'danger'
  });
  if (!confirmed) return;

  isDeleting.value = true;
  try {
    const result = await requestDeletion(confirmEmail.value);
    if (!result.ok) {
      toast.error(result.message || '提交失败，请稍后重试');
      return;
    }
    deletionRequestedAt.value = result.data?.deletionRequestedAt ?? null;
    deletionDaysLeft.value = result.data?.deletionDaysLeft ?? null;
    confirmEmail.value = '';
    toast.success('注销申请已提交，7 天内登录可撤销');
  } finally {
    isDeleting.value = false;
  }
}

async function handleCancelDeletion() {
  const result = await cancelDeletion();
  if (!result.ok) {
    toast.error(result.message || '撤销失败，请稍后重试');
    return;
  }
  deletionRequestedAt.value = null;
  deletionDaysLeft.value = null;
  toast.success('已撤销注销申请，账号恢复正常');
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
    <Navbar />

    <main id="main-content" tabindex="-1" class="flex-1">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <nav aria-label="面包屑" class="text-2xs text-slate-500 mb-4">
          <RouterLink to="/dashboard" class="hover:text-primary-600">工作台</RouterLink>
          <span class="mx-1.5" aria-hidden="true">/</span>
          <span class="text-slate-700">账号设置</span>
        </nav>

        <h1 class="text-2xl font-black text-slate-950">账号设置</h1>
        <p class="text-sm text-slate-600 mt-2">管理登录密码、导出你的数据，或注销账号。</p>

        <!-- 注销冷静期横幅：只在该状态下出现 -->
        <div
          v-if="deletionDaysLeft !== null"
          class="mt-6 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3.5 flex items-start gap-3"
          role="status"
        >
          <AlertTriangle class="w-4 h-4 text-warning-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-warning-800">账号已进入注销冷静期</p>
            <p class="text-xs text-warning-700 mt-1 leading-relaxed">
              还剩 {{ deletionDaysLeft }} 天。到期后简历、版本历史、分享链接与投递记录将永久删除。
              期间登录会自动撤销；也可以在这里立即撤销。
            </p>
            <AppButton size="sm" variant="secondary" class="mt-2.5" @click="handleCancelDeletion">
              撤销注销
            </AppButton>
          </div>
        </div>

        <div class="space-y-5 mt-6">
          <!-- 账号信息 -->
          <AppCard>
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <User class="w-4 h-4 text-slate-500" aria-hidden="true" />
              账号信息
            </h2>
            <dl class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <dt class="text-slate-500">邮箱</dt>
                <dd class="font-medium text-slate-900 mt-0.5 break-all">{{ email }}</dd>
              </div>
              <div>
                <dt class="text-slate-500">昵称</dt>
                <dd class="font-medium text-slate-900 mt-0.5">{{ authStore.user?.nickname || '未设置' }}</dd>
              </div>
            </dl>
            <p class="text-2xs text-slate-500 mt-3 flex items-center gap-1.5">
              <ShieldCheck class="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
              密码经 PBKDF2 加盐存储，服务端不保存明文
            </p>
          </AppCard>

          <!-- 修改密码 -->
          <AppCard>
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <KeyRound class="w-4 h-4 text-slate-500" aria-hidden="true" />
              修改密码
            </h2>
            <form class="mt-3 space-y-3" novalidate @submit.prevent="handleChangePassword">
              <FormField label="当前密码" id="settings-current-password" required>
                <template #default="{ id }">
                  <AppInput
                    :id="id"
                    v-model="currentPassword"
                    type="password"
                    autocomplete="current-password"
                    placeholder="用于确认是你本人"
                  />
                </template>
              </FormField>

              <FormField label="新密码" id="settings-new-password" required hint="至少 6 位">
                <template #default="{ id, describedBy }">
                  <AppInput
                    :id="id"
                    v-model="newPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="至少 6 位字符"
                    :aria-describedby="describedBy"
                  />
                </template>
              </FormField>

              <FormField
                label="确认新密码"
                id="settings-confirm-password"
                required
                :error="passwordError || undefined"
              >
                <template #default="{ id, describedBy, invalid }">
                  <AppInput
                    :id="id"
                    v-model="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="再输入一次"
                    :invalid="invalid"
                    :aria-describedby="describedBy"
                  />
                </template>
              </FormField>

              <AppButton type="submit" :loading="isChangingPassword" :disabled="!canSubmitPassword">
                更新密码
              </AppButton>
            </form>
          </AppCard>

          <!-- 导出数据 -->
          <AppCard>
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Download class="w-4 h-4 text-slate-500" aria-hidden="true" />
              导出我的数据
            </h2>
            <p class="text-xs text-slate-600 mt-2 leading-relaxed">
              下载一份 JSON，包含全部简历正文、版本历史、分享链接与投递记录。
              不含访问统计（那是访客的行为数据）与密码哈希。
            </p>
            <AppButton
              variant="secondary"
              class="mt-3"
              :loading="isSubmitting"
              @click="handleExport"
            >
              导出为 JSON
            </AppButton>
          </AppCard>

          <!-- AI 改写 -->
          <AppCard>
            <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-slate-500" aria-hidden="true" />
              AI 改写
            </h2>
            <p class="text-xs text-slate-600 mt-2 mb-3 leading-relaxed">
              用自己的 API Key 接入模型，在编辑器里对某一段描述做改写。
              改写结果会先显示改动对照，由你确认后才写入简历。
            </p>
            <AiProviderForm :config="aiConfig" @update:config="aiConfig = $event" />
          </AppCard>

          <!-- 注销账号 -->
          <AppCard class="border-danger-200">
            <h2 class="text-sm font-bold text-danger-700 flex items-center gap-1.5">
              <Trash2 class="w-4 h-4" aria-hidden="true" />
              注销账号
            </h2>
            <p class="text-xs text-slate-600 mt-2 leading-relaxed">
              提交后有 7 天冷静期，期间登录即自动撤销。到期后所有简历、版本历史、分享链接与投递记录会被永久删除，无法恢复。
              建议先导出数据。
            </p>

            <div class="mt-3 max-w-sm">
              <FormField
                label="输入账号邮箱以确认"
                id="settings-confirm-email"
                :hint="email"
              >
                <template #default="{ id, describedBy }">
                  <AppInput
                    :id="id"
                    v-model="confirmEmail"
                    type="email"
                    autocomplete="off"
                    :placeholder="email"
                    :aria-describedby="describedBy"
                  />
                </template>
              </FormField>
            </div>

            <AppButton
              variant="danger"
              class="mt-3"
              :loading="isDeleting"
              :disabled="deletionDaysLeft !== null"
              @click="handleRequestDeletion"
            >
              {{ deletionDaysLeft !== null ? '已在冷静期中' : '申请注销账号' }}
            </AppButton>
          </AppCard>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
