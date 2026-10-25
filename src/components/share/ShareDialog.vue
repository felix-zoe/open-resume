<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import {
  Copy,
  QrCode,
  Trash2,
  Link2,
  ShieldCheck,
  EyeOff,
  Download,
  Loader2,
  Plus,
  Check
} from 'lucide-vue-next';
import { AppModal, AppButton, AppInput, AppSelect, AppSwitch, AppBadge } from '../ui';
import { apiFetch } from '../../utils/http';
import { useToast } from '../../composables/useToast';
import { askConfirm } from '../../composables/useConfirm';
import { renderQrToCanvas, downloadCanvas } from '../../utils/qrcode';
import {
  SHARE_TTL_OPTIONS,
  absoluteShareUrl,
  formatExpiry,
  formatDate,
  isLinkUsable,
  shareStatusLabel,
  shareStatusTone,
  type ShareLink,
  type ShareTtl
} from '../../utils/share';
import { trackEvent } from '../../utils/telemetry';

const props = withDefaults(
  defineProps<{
    open: boolean;
    resumeId: string;
    resumeTitle?: string;
    /** 当前公开状态，由父级传入（编辑器/工作台各自已有这份数据） */
    isPublic?: number;
  }>(),
  { resumeTitle: '我的简历', isPublic: 0 }
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'update:isPublic', value: number): void;
}>();

const toast = useToast();

const links = ref<ShareLink[]>([]);
const loading = ref(false);
const creating = ref(false);
const busyId = ref<string | null>(null);
const publicEnabled = ref(props.isPublic === 1);

/** 新建链接的表单状态 */
const ttl = ref<ShareTtl>('30d');
const password = ref('');
const maskContact = ref(true);
const allowDownload = ref(true);

/** 二维码：一次只展示一个 */
const qrLinkId = ref<string | null>(null);
const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrLoading = ref(false);
const copiedId = ref<string | null>(null);

const ttlOptions = SHARE_TTL_OPTIONS.map((item) => ({ value: item.value, label: item.label }));

watch(
  () => props.isPublic,
  (value) => {
    publicEnabled.value = value === 1;
  }
);

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      qrLinkId.value = null;
      return;
    }
    password.value = '';
    await loadLinks();
  }
);

async function loadLinks() {
  if (!props.resumeId) return;
  loading.value = true;
  try {
    const result = await apiFetch<ShareLink[]>(`/api/resumes/${props.resumeId}/share-links`);
    if (!result.ok) {
      toast.error(result.message || '读取分享链接失败');
      return;
    }
    links.value = Array.isArray(result.data) ? result.data : [];
  } finally {
    loading.value = false;
  }
}

async function togglePublic(next: boolean) {
  publicEnabled.value = next;
  const previous = next ? 0 : 1;
  const result = await apiFetch(`/api/resumes/${props.resumeId}/share`, {
    method: 'POST',
    body: { isPublic: next ? 1 : 0 }
  });
  if (!result.ok) {
    publicEnabled.value = !next;
    emit('update:isPublic', previous);
    toast.error(result.message || '更新公开状态失败');
    return;
  }
  emit('update:isPublic', next ? 1 : 0);
  trackEvent(next ? 'share.public.on' : 'share.public.off');
  toast.success(next ? '已开启公开分享' : '已关闭公开分享');
}

async function createLink() {
  if (creating.value) return;
  if (password.value && (password.value.length < 4 || password.value.length > 64)) {
    toast.error('访问密码需为 4-64 个字符');
    return;
  }

  creating.value = true;
  try {
    const result = await apiFetch<{ token: string; id: string }>(
      `/api/resumes/${props.resumeId}/share-links`,
      {
        method: 'POST',
        body: {
          ttl: ttl.value,
          password: password.value || undefined,
          maskContact: maskContact.value,
          allowDownload: allowDownload.value
        }
      }
    );
    if (!result.ok || !result.data?.token) {
      toast.error(result.message || '创建分享链接失败');
      return;
    }
    password.value = '';
    await loadLinks();
    trackEvent('share.link.create');
    toast.success('分享链接已创建');
    await copyLink(absoluteShareUrl(result.data.token));
  } finally {
    creating.value = false;
  }
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('分享链接已复制');
  } catch {
    toast.copyFallback('浏览器拒绝了剪贴板访问，请手动复制下面的链接', url);
  }
}

async function copyWithFeedback(link: ShareLink) {
  await copyLink(absoluteShareUrl(link.token));
  copiedId.value = link.id;
  setTimeout(() => {
    if (copiedId.value === link.id) copiedId.value = null;
  }, 2000);
}

async function revoke(link: ShareLink) {
  const confirmed = await askConfirm({
    title: '撤销这条分享链接？',
    description: '撤销后该链接立即失效，已经发出的链接将无法再打开。',
    confirmText: '撤销',
    tone: 'danger'
  });
  if (!confirmed) return;

  busyId.value = link.id;
  try {
    const result = await apiFetch(`/api/share-links/${link.id}`, { method: 'DELETE' });
    if (!result.ok) {
      toast.error(result.message || '撤销失败');
      return;
    }
    toast.success('已撤销该分享链接');
    await loadLinks();
  } finally {
    busyId.value = null;
  }
}

async function toggleQr(link: ShareLink) {
  if (qrLinkId.value === link.id) {
    qrLinkId.value = null;
    return;
  }
  qrLinkId.value = link.id;
  qrLoading.value = true;
  try {
    await nextTick();
    if (!qrCanvas.value) return;
    await renderQrToCanvas(qrCanvas.value, absoluteShareUrl(link.token), { size: 220 });
  } catch (err) {
    qrLinkId.value = null;
    toast.error('二维码生成失败，请直接复制链接');
    console.error(err);
  } finally {
    qrLoading.value = false;
  }
}

function saveQr(title: string) {
  if (!qrCanvas.value) return;
  const safe = title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '简历';
  downloadCanvas(qrCanvas.value, `${safe}-分享二维码.png`);
}

const activeLinks = computed(() => links.value.filter((link) => isLinkUsable(link)));
const inactiveLinks = computed(() => links.value.filter((link) => !isLinkUsable(link)));

const qrActiveLink = computed(() => links.value.find((link) => link.id === qrLinkId.value) ?? null);

function close() {
  emit('update:open', false);
}
</script>

<template>
  <AppModal
    :open="open"
    size="lg"
    title="分享简历"
    description="生成只读链接发给 HR 或朋友。链接可设有效期、访问密码，并可隐藏联系方式。"
    @update:open="close"
  >
    <div class="space-y-5">
      <!-- 公开状态 -->
      <section class="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
        <AppSwitch
          :model-value="publicEnabled"
          label="开启公开分享"
          description="关闭后，所有分享链接与 /share 页面都会立即失效。"
          @update:model-value="togglePublic"
        />
        <p class="text-2xs text-slate-500 leading-relaxed flex items-start gap-1.5">
          <ShieldCheck class="w-3.5 h-3.5 text-success-600 shrink-0 mt-px" aria-hidden="true" />
          <span>
            默认对访客隐藏完整手机号与邮箱（显示为 <code class="font-mono">138****8000</code> /
            <code class="font-mono">z***@example.com</code>）。HR 需要电话联系时，请直接私信发送。
          </span>
        </p>
      </section>

      <!-- 新建链接 -->
      <section class="space-y-3">
        <h3 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Plus class="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
          <span>生成新链接</span>
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-2xs font-semibold text-slate-600 mb-1">有效期</label>
            <AppSelect v-model="ttl" :options="ttlOptions" aria-label="分享链接有效期" />
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-600 mb-1">访问密码 (选填)</label>
            <AppInput
              v-model="password"
              type="text"
              placeholder="留空则无需密码"
              autocomplete="off"
              aria-label="访问密码"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AppSwitch
            v-model="maskContact"
            label="隐藏联系方式"
            description="手机号与邮箱打码"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
          <AppSwitch
            v-model="allowDownload"
            label="允许下载 PDF"
            description="访客可用浏览器打印"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </div>

        <AppButton :loading="creating" block @click="createLink">
          <template #icon>
            <Link2 class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>{{ creating ? '生成中...' : '生成链接并复制' }}</span>
        </AppButton>
      </section>

      <!-- 已有链接 -->
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-800">已生成的链接</h3>
          <span v-if="links.length" class="text-2xs text-slate-500">
            {{ activeLinks.length }} 条生效中
          </span>
        </div>

        <div v-if="loading" class="py-6 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
          <span class="text-2xs">读取中...</span>
        </div>

        <p v-else-if="!links.length" class="text-2xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          还没有生成过分享链接
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="link in links"
            :key="link.id"
            class="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <AppBadge :tone="shareStatusTone(link.status)" dot>
                    {{ shareStatusLabel(link.status) }}
                  </AppBadge>
                  <AppBadge v-if="link.hasPassword" tone="primary">有密码</AppBadge>
                  <AppBadge v-if="link.maskContact" tone="neutral">联系方式已隐藏</AppBadge>
                  <AppBadge v-if="!link.allowDownload" tone="neutral">禁止下载</AppBadge>
                </div>
                <p class="text-2xs text-slate-500">
                  {{ formatExpiry(link.expiresAt) }}
                  <span v-if="link.createdAt"> · 创建于 {{ formatDate(link.createdAt) }}</span>
                  <span v-if="link.viewCount"> · 已访问 {{ link.viewCount }} 次</span>
                </p>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-40"
                  :disabled="!isLinkUsable(link)"
                  :aria-label="qrLinkId === link.id ? '收起二维码' : '显示二维码'"
                  :title="qrLinkId === link.id ? '收起二维码' : '显示二维码'"
                  @click="toggleQr(link)"
                >
                  <QrCode class="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-40"
                  :disabled="!isLinkUsable(link)"
                  aria-label="复制链接"
                  title="复制链接"
                  @click="copyWithFeedback(link)"
                >
                  <Check v-if="copiedId === link.id" class="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
                  <Copy v-else class="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  v-if="!link.revokedAt"
                  type="button"
                  class="p-1.5 rounded-lg text-slate-500 hover:bg-danger-50 hover:text-danger-600 transition disabled:opacity-40"
                  :disabled="busyId === link.id"
                  aria-label="撤销链接"
                  title="撤销链接"
                  @click="revoke(link)"
                >
                  <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p class="text-2xs font-mono text-slate-600 bg-slate-50 rounded px-2 py-1 truncate">
              {{ absoluteShareUrl(link.token) }}
            </p>
          </li>
        </ul>

        <!-- 二维码：一次只展示一个，放在列表外避免 v-for 里的 ref 变成数组 -->
        <div v-if="qrActiveLink" class="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <p class="text-2xs text-slate-500 self-start">
            {{ qrActiveLink.label || '分享链接' }} 的二维码
          </p>
          <div class="relative w-[220px] h-[220px] flex items-center justify-center bg-white rounded-lg border border-slate-200">
            <canvas ref="qrCanvas" width="220" height="220" aria-label="分享链接二维码" role="img" />
            <div v-if="qrLoading" class="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 class="w-5 h-5 animate-spin text-slate-400" aria-hidden="true" />
            </div>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-2xs font-semibold text-primary-600 hover:underline"
            @click="saveQr(resumeTitle)"
          >
            <Download class="w-3 h-3" aria-hidden="true" />
            <span>保存二维码 PNG</span>
          </button>
        </div>

        <p v-if="inactiveLinks.length" class="text-2xs text-slate-500 flex items-center gap-1">
          <EyeOff class="w-3 h-3" aria-hidden="true" />
          <span>已撤销或过期的链接保留在列表中，方便你核对曾发出过哪些地址。</span>
        </p>
      </section>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="close">完成</AppButton>
    </template>
  </AppModal>
</template>
