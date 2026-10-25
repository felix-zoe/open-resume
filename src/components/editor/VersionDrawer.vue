<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { History, Loader2, RotateCcw, Save, Trash2, Tag, Clock } from 'lucide-vue-next';
import { AppDrawer, AppButton, AppInput, AppBadge } from '../ui';
import { apiFetch } from '../../utils/http';
import { useToast } from '../../composables/useToast';
import { askConfirm } from '../../composables/useConfirm';

export interface ResumeVersion {
  id: string;
  label: string | null;
  title: string;
  templateId: string;
  wordCount: number;
  source: 'auto' | 'manual' | 'restore';
  createdAt: number;
}

const props = defineProps<{
  open: boolean;
  resumeId: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  /** 恢复成功后把内容推回编辑器，避免再拉一次整份简历 */
  (e: 'restored', payload: {
    title: string;
    templateId: string;
    content: any;
    themeConfig: any;
  }): void;
}>();

const toast = useToast();

const versions = ref<ResumeVersion[]>([]);
const loading = ref(false);
const busyId = ref<string | null>(null);
const label = ref('');
const saving = ref(false);

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      label.value = '';
      void load();
    }
  }
);

async function load() {
  if (!props.resumeId) return;
  loading.value = true;
  try {
    const result = await apiFetch<ResumeVersion[]>(`/api/resumes/${props.resumeId}/versions`);
    if (!result.ok) {
      toast.error(result.message || '读取版本历史失败');
      return;
    }
    versions.value = Array.isArray(result.data) ? result.data : [];
  } finally {
    loading.value = false;
  }
}

async function saveManual() {
  if (saving.value) return;
  saving.value = true;
  try {
    const result = await apiFetch(`/api/resumes/${props.resumeId}/versions`, {
      method: 'POST',
      body: { label: label.value.trim() }
    });
    if (!result.ok) {
      toast.info(result.message || '当前内容与最近版本相同');
      return;
    }
    label.value = '';
    toast.success('已保存为新版本');
    await load();
  } finally {
    saving.value = false;
  }
}

async function restore(version: ResumeVersion) {
  const confirmed = await askConfirm({
    title: '恢复到这个版本？',
    description: '当前内容会先自动备份成一个版本，恢复后仍可再撤回到当前状态。',
    confirmText: '恢复'
  });
  if (!confirmed) return;

  busyId.value = version.id;
  try {
    const result = await apiFetch<{
      title: string;
      templateId: string;
      content: any;
      themeConfig: any;
    }>(`/api/resumes/${props.resumeId}/versions/${version.id}/restore`, { method: 'POST' });

    if (!result.ok || !result.data) {
      toast.error(result.message || '恢复失败');
      return;
    }
    emit('restored', result.data);
    toast.success('已恢复到该版本');
    await load();
  } finally {
    busyId.value = null;
  }
}

async function remove(version: ResumeVersion) {
  const confirmed = await askConfirm({
    title: '删除这个版本？',
    description: '删除后无法恢复。当前简历内容不受影响。',
    confirmText: '删除',
    tone: 'danger'
  });
  if (!confirmed) return;

  busyId.value = version.id;
  try {
    const result = await apiFetch(`/api/resumes/${props.resumeId}/versions/${version.id}`, {
      method: 'DELETE'
    });
    if (!result.ok) {
      toast.error(result.message || '删除失败');
      return;
    }
    versions.value = versions.value.filter((row) => row.id !== version.id);
    toast.success('已删除该版本');
  } finally {
    busyId.value = null;
  }
}

function formatTime(seconds: number): string {
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sourceLabel(source: ResumeVersion['source']): string {
  if (source === 'manual') return '手动保存';
  if (source === 'restore') return '恢复前备份';
  return '自动保存';
}

function sourceTone(source: ResumeVersion['source']): 'primary' | 'neutral' | 'warning' {
  if (source === 'manual') return 'primary';
  if (source === 'restore') return 'warning';
  return 'neutral';
}
</script>

<template>
  <AppDrawer v-model:open="open" title="版本历史" width-class="w-[22rem]">
    <!-- 手动保存 -->
    <div class="space-y-2 mb-4">
      <label for="version-label" class="block text-2xs font-semibold text-slate-600">
        给当前内容起个名字（选填）
      </label>
      <div class="flex items-center gap-2">
        <AppInput
          id="version-label"
          v-model="label"
          placeholder="如：投递前定稿"
          maxlength="50"
          @keyup.enter="saveManual"
        />
        <AppButton :loading="saving" class="shrink-0" @click="saveManual">
          <template #icon>
            <Save class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>保存</span>
        </AppButton>
      </div>
      <p class="text-2xs text-slate-500 leading-relaxed">
        自动版本仅在内容变化且距上次超过 10 分钟时生成，每份简历保留最近 20 个。
      </p>
    </div>

    <div v-if="loading" class="py-10 flex items-center justify-center text-slate-400 gap-2">
      <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
      <span class="text-2xs">读取中...</span>
    </div>

    <p
      v-else-if="!versions.length"
      class="text-2xs text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-lg leading-relaxed"
    >
      还没有历史版本。<br />继续编辑，10 分钟后会自动生成第一个版本。
    </p>

    <!-- 时间线 -->
    <ol v-else class="relative space-y-3 pl-4">
      <span class="absolute left-[5px] top-1 bottom-1 w-px bg-slate-200" aria-hidden="true" />
      <li
        v-for="version in versions"
        :key="version.id"
        class="relative"
      >
        <span
          class="absolute -left-4 top-3 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-slate-200"
          :class="version.source === 'manual' ? 'bg-primary-500' : 'bg-slate-300'"
          aria-hidden="true"
        />
        <div class="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-xs font-semibold text-slate-900 truncate flex items-center gap-1">
                <Tag v-if="version.label" class="w-3 h-3 text-primary-500 shrink-0" aria-hidden="true" />
                <span>{{ version.label || version.title }}</span>
              </p>
              <p class="text-2xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Clock class="w-3 h-3" aria-hidden="true" />
                <span>{{ formatTime(version.createdAt) }}</span>
                <span>·</span>
                <span>{{ version.wordCount }} 字</span>
              </p>
            </div>
            <AppBadge :tone="sourceTone(version.source)">{{ sourceLabel(version.source) }}</AppBadge>
          </div>

          <div class="flex items-center gap-1.5">
            <AppButton
              size="sm"
              variant="subtle"
              :loading="busyId === version.id"
              class="flex-1"
              @click="restore(version)"
            >
              <template #icon>
                <RotateCcw class="w-3 h-3" aria-hidden="true" />
              </template>
              <span>恢复</span>
            </AppButton>
            <button
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition"
              aria-label="删除该版本"
              title="删除该版本"
              :disabled="busyId === version.id"
              @click="remove(version)"
            >
              <Trash2 class="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </li>
    </ol>

    <template #footer>
      <p class="text-2xs text-slate-500 flex items-center gap-1.5">
        <History class="w-3.5 h-3.5" aria-hidden="true" />
        <span>恢复前会自动备份当前内容，可再次恢复撤回。</span>
      </p>
    </template>
  </AppDrawer>
</template>
