<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { Sparkles, FileText, LogOut } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const handleLogout = () => {
  authStore.logout();
  router.push('/');
};
</script>

<template>
  <nav class="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
    <router-link to="/" class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
        R
      </div>
      <span class="font-extrabold text-base sm:text-lg bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
        OpenResume
      </span>
      <span class="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 hidden sm:inline-block">
        开源免费
      </span>
    </router-link>

    <div class="flex items-center gap-3 sm:gap-4">
      <router-link to="/editor/demo" class="text-xs font-semibold text-gray-600 hover:text-blue-600 transition flex items-center gap-1">
        <Sparkles class="w-3.5 h-3.5 text-blue-500" />
        <span>在线制作</span>
      </router-link>

      <template v-if="authStore.isLoggedIn">
        <router-link to="/dashboard" class="text-xs font-semibold text-gray-600 hover:text-blue-600 transition flex items-center gap-1">
          <FileText class="w-3.5 h-3.5" />
          <span>我的简历</span>
        </router-link>
        <button
          @click="handleLogout"
          class="text-xs text-gray-400 hover:text-rose-500 transition p-1"
          title="退出登录"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </template>
      <template v-else>
        <router-link
          to="/editor/demo"
          class="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl shadow-xs transition"
        >
          免费开始
        </router-link>
      </template>
    </div>
  </nav>
</template>
