<script setup lang="ts">
import ToastHost from './components/ui/ToastHost.vue';
import ConfirmHost from './components/ui/ConfirmHost.vue';
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
  </div>
</template>
