<script setup lang="ts">
import { onMounted } from 'vue';
import ToastHost from './components/ui/ToastHost.vue';
import ConfirmHost from './components/ui/ConfirmHost.vue';
import ChoiceHost from './components/ui/ChoiceHost.vue';
import PwaPrompt from './components/PwaPrompt.vue';
import { initPwa } from './composables/usePwa';

/**
 * 只注册一次 SW。放在 App 而不是 main：`virtual:pwa-register` 是构建期
 * 由插件生成的虚拟模块，放在入口会让开发期的 main.ts 依赖一个不存在的模块
 * （`devOptions.enabled` 为 false 时插件不提供它）。
 */
onMounted(() => {
  if (import.meta.env.PROD) void initPwa();
});
</script>

<template>
  <div class="app-root min-h-screen">
    <!-- 跳转链接：键盘用户可跳过导航直达主内容 -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-white focus:text-sm focus:font-semibold focus:text-primary-700 focus:shadow-lg focus:ring-2 focus:ring-primary-500"
    >
      跳到主要内容
    </a>

    <router-view />

    <!-- 全局反馈层：任意组件通过 useToast / askConfirm 调用 -->
    <ToastHost />
    <ConfirmHost />
    <ChoiceHost />

    <!-- PWA：新版本 / 离线就绪 / 安装引导 -->
    <PwaPrompt />
  </div>
</template>
