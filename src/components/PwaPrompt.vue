<script setup lang="ts">
import { ref } from 'vue';
import { Download, RefreshCw, WifiOff, X } from 'lucide-vue-next';
import { AppButton } from './ui';
import { usePwa } from '../composables/usePwa';

/**
 * PWA 提示层：新版本 / 离线就绪 / 安装引导。
 *
 * 三者共用一个固定在底部的容器，但**同一时刻只显示一条**：
 * 「有新版本」优先级最高（它关系到用户看到的是不是最新代码），
 * 其次是离线就绪（一次性告知），最后才是安装引导（可随时忽略）。
 *
 * 刻意不自动刷新：编辑器里可能正有未保存的内容，静默 reload 等于丢数据。
 */
const { needRefresh, offlineReady, canInstall, isInstalled, applyUpdate, dismissUpdate, promptInstall } =
  usePwa();

const isApplying = ref(false);
const isInstalling = ref(false);
const installDismissed = ref(false);
const offlineDismissed = ref(false);

async function handleUpdate() {
  isApplying.value = true;
  try {
    await applyUpdate();
  } finally {
    isApplying.value = false;
  }
}

async function handleInstall() {
  isInstalling.value = true;
  try {
    const accepted = await promptInstall();
    if (!accepted) installDismissed.value = true;
  } finally {
    isInstalling.value = false;
  }
}
</script>

<template>
  <!-- no-print：提示条不该出现在导出的 PDF 里 -->
  <div
    class="fixed z-50 bottom-4 inset-x-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 no-print"
    aria-live="polite"
  >
    <div
      v-if="needRefresh"
      class="flex items-start gap-3 rounded-xl border border-primary-200 bg-white px-3.5 py-3 shadow-lg"
    >
      <RefreshCw class="w-4 h-4 text-primary-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-900">有新版本可用</p>
        <p class="text-2xs text-slate-500 mt-0.5 leading-relaxed">
          刷新后生效。当前未保存的内容请先保存再刷新。
        </p>
        <div class="flex items-center gap-2 mt-2">
          <AppButton size="sm" :loading="isApplying" @click="handleUpdate">刷新更新</AppButton>
          <AppButton size="sm" variant="ghost" @click="dismissUpdate">稍后</AppButton>
        </div>
      </div>
    </div>

    <div
      v-else-if="offlineReady && !offlineDismissed"
      class="flex items-start gap-3 rounded-xl border border-success-200 bg-white px-3.5 py-3 shadow-lg"
    >
      <WifiOff class="w-4 h-4 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-900">已可离线使用</p>
        <p class="text-2xs text-slate-500 mt-0.5 leading-relaxed">
          断网时仍可打开编辑器继续编辑，联网后自动同步。
        </p>
      </div>
      <button
        type="button"
        class="p-0.5 rounded text-slate-400 hover:text-slate-600 transition shrink-0"
        aria-label="关闭提示"
        @click="offlineDismissed = true"
      >
        <X class="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>

    <div
      v-else-if="canInstall && !isInstalled && !installDismissed"
      class="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg"
    >
      <Download class="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-900">安装到桌面</p>
        <p class="text-2xs text-slate-500 mt-0.5 leading-relaxed">
          像本地应用一样打开，离线也能编辑简历。
        </p>
        <div class="flex items-center gap-2 mt-2">
          <AppButton size="sm" variant="secondary" :loading="isInstalling" @click="handleInstall">
            立即安装
          </AppButton>
          <AppButton size="sm" variant="ghost" @click="installDismissed = true">不用了</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
