<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import {
  Sparkles,
  FileText,
  LogOut,
  ChevronDown,
  Plus
} from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const isMenuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const handleLogout = () => {
  isMenuOpen.value = false;
  authStore.logout();
  router.push('/');
};

const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    isMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <nav class="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
    <!-- 左侧 Logo 与品牌标语 -->
    <router-link to="/" class="flex items-center gap-2.5 group">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 group-hover:scale-105 transition transform">
        R
      </div>
      <span class="font-extrabold text-base sm:text-lg bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
        OpenResume
      </span>
      <span class="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 hidden sm:inline-block">
        开源免费
      </span>
    </router-link>

    <!-- 右侧导航与用户态 -->
    <div class="flex items-center gap-3 sm:gap-4">
      <router-link
        to="/editor/demo"
        class="text-xs font-semibold text-slate-600 hover:text-blue-600 transition flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50"
      >
        <Sparkles class="w-3.5 h-3.5 text-blue-500" />
        <span>在线制作</span>
      </router-link>

      <!-- 1. 已登录：用户个人中心下拉菜单 -->
      <div v-if="authStore.isLoggedIn" class="relative" ref="menuRef">
        <button
          @click.stop="isMenuOpen = !isMenuOpen"
          class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100/80 transition cursor-pointer"
        >
          <!-- 头像或首字母徽章 -->
          <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden shadow-2xs">
            <img
              v-if="authStore.user?.avatarUrl"
              :src="authStore.user.avatarUrl"
              class="w-full h-full object-cover"
            />
            <span v-else>
              {{ (authStore.user?.nickname || authStore.user?.email || 'U')[0].toUpperCase() }}
            </span>
          </div>

          <span class="text-xs font-bold text-slate-700 hidden sm:inline max-w-[120px] truncate">
            {{ authStore.user?.nickname || authStore.user?.email?.split('@')[0] }}
          </span>

          <ChevronDown
            class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
            :class="{ 'rotate-180': isMenuOpen }"
          />
        </button>

        <!-- 悬浮下拉菜单 -->
        <transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div
            v-if="isMenuOpen"
            class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 text-xs z-50 overflow-hidden"
          >
            <!-- 头部账号信息展示 -->
            <div class="px-3 py-2.5 border-b border-slate-100 mb-1">
              <div class="font-bold text-slate-900 truncate">
                {{ authStore.user?.nickname || '求职者' }}
              </div>
              <div class="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                {{ authStore.user?.email }}
              </div>
            </div>

            <!-- 菜单选项 -->
            <div class="space-y-0.5">
              <router-link
                to="/dashboard"
                @click="isMenuOpen = false"
                class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-50 font-medium transition"
              >
                <FileText class="w-3.5 h-3.5 text-slate-400" />
                <span>我的简历看板</span>
              </router-link>

              <router-link
                to="/editor/demo"
                @click="isMenuOpen = false"
                class="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-50 font-medium transition"
              >
                <Plus class="w-3.5 h-3.5 text-slate-400" />
                <span>新建一份简历</span>
              </router-link>
            </div>

            <!-- 退出登录 -->
            <div class="border-t border-slate-100 mt-1 pt-1">
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition cursor-pointer"
              >
                <LogOut class="w-3.5 h-3.5 text-rose-500" />
                <span>退出登录</span>
              </button>
            </div>
          </div>
        </transition>
      </div>

      <!-- 2. 未登录：登录链接 + 免费注册按钮 -->
      <template v-else>
        <router-link
          to="/login"
          class="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-50 transition"
        >
          登录
        </router-link>

        <router-link
          to="/register"
          class="text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition transform hover:-translate-y-0.5"
        >
          免费注册
        </router-link>
      </template>
    </div>
  </nav>
</template>
