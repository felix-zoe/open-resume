<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { triggerPrintPdf } from '../utils/exportPdf';
import { apiFetch } from '../utils/http';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import ClassicTemplate from '../templates/ClassicTemplate.vue';
import GeekTemplate from '../templates/GeekTemplate.vue';
import ModernTemplate from '../templates/ModernTemplate.vue';
import AtsTemplate from '../templates/AtsTemplate.vue';
import { Download, Sparkles, Loader2, AlertCircle, Lock, EyeOff } from 'lucide-vue-next';
import { AppButton, AppInput } from '../components/ui';

const route = useRoute();
/** 两种分享形态：旧版 `/share/:id`（简历 id）与 token 化 `/s/:token` */
const legacyId = typeof route.params.id === 'string' ? route.params.id : '';
const token = typeof route.params.token === 'string' ? route.params.token : '';
const isTokenMode = Boolean(token);

const loading = ref(true);
const notFound = ref(false);
const isExporting = ref(false);
const title = ref('个人简历');
const templateId = ref('classic');
const content = ref<ResumeContent>(JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)));
const themeConfig = ref<ThemeConfig>(JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)));
const allowDownload = ref(true);
const maskContact = ref(false);

/** 密码保护的 token 链接：先锁住，解锁后才渲染简历 */
const requiresPassword = ref(false);
const passwordInput = ref('');
const passwordError = ref('');
const unlocking = ref(false);

// 访客访问统计：一次会话只上报一次，下载算作同一次访问的附加事件
const startTime = ref(Date.now());
let hasReported = false;

/** 上报接口随分享形态切换；旧版用简历 id，新版用 token */
function visitEndpoint(): string | null {
  if (isTokenMode) return `/api/s/${token}/visit`;
  if (legacyId && legacyId !== 'demo' && legacyId !== 'local-draft') {
    return `/api/share/${legacyId}/visit`;
  }
  return null;
}

function reportVisit(isDownloaded = false) {
  const endpoint = visitEndpoint();
  if (!endpoint) return;

  // 后端限制 0–1800s：超过这个长度的「停留」多半是标签页挂着没关，不是真实阅读
  const duration = Math.min(1800, Math.max(1, Math.round((Date.now() - startTime.value) / 1000)));
  const payload = JSON.stringify({ duration, isDownloaded });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
  } else {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
}

const handlePrint = async () => {
  if (isExporting.value || notFound.value || requiresPassword.value) return;
  if (!allowDownload.value) return;
  isExporting.value = true;
  // 下载后置位：否则关闭页面时 pagehide 会再记一次，导出数虚高
  if (!hasReported) {
    reportVisit(true);
    hasReported = true;
  }
  try {
    await triggerPrintPdf(title.value);
  } finally {
    isExporting.value = false;
  }
};

const currentTemplateComponent = computed(() => {
  switch (templateId.value) {
    case 'geek': return GeekTemplate;
    case 'modern': return ModernTemplate;
    case 'ats': return AtsTemplate;
    case 'classic':
    default: return ClassicTemplate;
  }
});

const errorMsg = ref('该在线简历不存在或已关闭分享');

function applyPayload(data: any) {
  title.value = data.title || '个人简历';
  templateId.value = data.templateId || 'classic';
  content.value = data.content || content.value;
  themeConfig.value = data.themeConfig || themeConfig.value;
  allowDownload.value = data.allowDownload !== false;
  maskContact.value = data.maskContact === true;
  startTime.value = Date.now();
}

async function loadByToken() {
  const result = await apiFetch<any>(`/api/s/${token}`, { auth: false });
  if (!result.ok) {
    notFound.value = true;
    errorMsg.value = result.message || '该分享链接已失效，请联系求职者重新生成';
    return;
  }
  if (result.data?.requiresPassword) {
    requiresPassword.value = true;
    title.value = result.data.title || '个人简历';
    return;
  }
  applyPayload(result.data || {});
}

async function unlock() {
  if (unlocking.value) return;
  passwordError.value = '';
  if (!passwordInput.value) {
    passwordError.value = '请输入访问密码';
    return;
  }
  unlocking.value = true;
  try {
    const result = await apiFetch<any>(`/api/s/${token}/unlock`, {
      method: 'POST',
      auth: false,
      body: { password: passwordInput.value }
    });
    if (!result.ok) {
      passwordError.value = result.message || '访问密码不正确';
      return;
    }
    requiresPassword.value = false;
    passwordInput.value = '';
    applyPayload(result.data || {});
  } finally {
    unlocking.value = false;
  }
}

async function loadLegacy() {
  if (!legacyId || legacyId === 'demo' || legacyId === 'local-draft') return;
  const result = await apiFetch<any>(`/api/share/${legacyId}`, { auth: false });
  if (!result.ok) {
    notFound.value = true;
    if (result.status === 403 || result.code === 40301) {
      errorMsg.value = '该简历暂未开启公开分享，请联系求职者开启后查阅';
    } else {
      errorMsg.value = '该在线简历不存在或已失效';
    }
    return;
  }
  if (!result.data) {
    notFound.value = true;
    return;
  }
  applyPayload(result.data);
}

/** 关闭/隐藏页面时补一次上报；用 pagehide 而不是 beforeunload（移动端不触发后者） */
function handlePageHide() {
  if (hasReported) return;
  reportVisit(false);
  hasReported = true;
}

onMounted(async () => {
  try {
    if (isTokenMode) await loadByToken();
    else await loadLegacy();
  } finally {
    loading.value = false;
  }

  window.addEventListener('pagehide', handlePageHide);
});

onUnmounted(() => {
  window.removeEventListener('pagehide', handlePageHide);
  handlePageHide();
});
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col items-center">
    <!-- 顶部极简操作条 -->
    <header class="no-print w-full bg-white border-b border-slate-200 py-3 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      <div class="flex items-center gap-2">
        <span class="font-extrabold text-sm text-primary-600">OpenResume</span>
        <span class="text-xs text-slate-500">· 在线高清阅览</span>
      </div>

      <div class="flex items-center gap-3">
        <router-link to="/editor/new" class="text-xs font-semibold text-slate-600 hover:text-primary-600 flex items-center gap-1">
          <Sparkles class="w-3.5 h-3.5 text-primary-500" />
          <span>制作我的同款简历</span>
        </router-link>

        <AppButton
          v-if="allowDownload"
          size="sm"
          :loading="isExporting"
          :disabled="loading || notFound || requiresPassword"
          @click="handlePrint"
        >
          <template #icon>
            <Download class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>{{ isExporting ? '准备中...' : '另存为 PDF' }}</span>
        </AppButton>
      </div>
    </header>

    <!-- 加载中指示 -->
    <div v-if="loading" class="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
      <Loader2 class="w-8 h-8 animate-spin text-primary-600" />
      <span class="text-xs">正在以毫秒级自适应排版加载简历...</span>
    </div>

    <!-- 需要访问密码 -->
    <div v-else-if="requiresPassword" class="py-24 w-full max-w-xs px-4">
      <form class="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4" @submit.prevent="unlock">
        <div class="w-11 h-11 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
          <Lock class="w-5 h-5" aria-hidden="true" />
        </div>
        <div class="text-center">
          <h1 class="text-sm font-bold text-slate-900">这份简历需要访问密码</h1>
          <p class="text-2xs text-slate-500 mt-1">请向求职者索取访问密码后继续查看</p>
        </div>
        <div>
          <label for="share-password" class="sr-only">访问密码</label>
          <AppInput
            id="share-password"
            v-model="passwordInput"
            type="password"
            placeholder="输入访问密码"
            autocomplete="off"
            :invalid="!!passwordError"
            :aria-describedby="passwordError ? 'share-password-error' : undefined"
            @input="passwordError = ''"
          />
          <p v-if="passwordError" id="share-password-error" class="text-2xs font-medium text-danger-600 mt-1.5" role="alert">
            {{ passwordError }}
          </p>
        </div>
        <AppButton type="submit" block :loading="unlocking">
          {{ unlocking ? '验证中...' : '查看简历' }}
        </AppButton>
      </form>
    </div>

    <!-- 简历不存在 / 链接失效 -->
    <div v-else-if="notFound" class="py-24 text-center max-w-sm px-4">
      <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
        <AlertCircle class="w-6 h-6" />
      </div>
      <h1 class="text-base font-bold text-slate-800">{{ errorMsg }}</h1>
      <p class="text-xs text-slate-500 mt-1">求职者可能已更新链接或更改了该在线版本的分享权限。</p>
      <div class="mt-5">
        <router-link to="/" class="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
          <span>返回 OpenResume 首页</span>
        </router-link>
      </div>
    </div>

    <!-- 真实标准 A4 画布展示 -->
    <main v-else id="main-content" tabindex="-1" class="share-main-area py-8 flex justify-center w-full overflow-x-auto">
      <div
        class="a4-page a4-print-target bg-white shadow-xl rounded-sm"
        style="width: 210mm; min-height: 297mm"
        role="document"
        :aria-label="`${title} 在线简历`"
      >
        <component
          :is="currentTemplateComponent"
          :content="content"
          :theme="themeConfig"
        />
      </div>
    </main>

    <!-- 联系方式已脱敏时给出说明，避免访客以为是数据缺失 -->
    <p
      v-if="!loading && !notFound && !requiresPassword && maskContact"
      class="no-print text-2xs text-slate-500 pb-6 flex items-center gap-1"
    >
      <EyeOff class="w-3 h-3" aria-hidden="true" />
      <span>求职者选择隐藏了完整联系方式，如需电话沟通请直接与其联系。</span>
    </p>
  </div>
</template>
