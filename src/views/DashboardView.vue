<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AuthModal from '../components/AuthModal.vue';
import { useAuthStore } from '../stores/auth';
import { Plus, Trash2, Copy, Edit3, Clock } from 'lucide-vue-next';

interface ResumeSummary {
  id: string;
  title: string;
  templateId: string;
  updatedAt: string | number;
}

const router = useRouter();
const authStore = useAuthStore();

const isAuthModalOpen = ref(false);
const resumes = ref<ResumeSummary[]>([
  {
    id: 'demo',
    title: '资深前端研发工程师-张小凡',
    templateId: 'classic',
    updatedAt: '本地示范'
  }
]);

// 格式化时间戳或时间字符串
const formatTime = (time: string | number) => {
  if (typeof time === 'number') {
    const d = new Date(time * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return time;
};

// 从云端或本地拉取数据
const fetchResumes = async () => {
  if (!authStore.isLoggedIn) return;
  try {
    const res = await fetch('/api/resumes', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    const data: any = await res.json();
    if (data.code === 0 && Array.isArray(data.data)) {
      resumes.value = data.data;
    }
  } catch (err) {
    console.error('拉取云端简历列表失败，使用本地列表', err);
  }
};

onMounted(() => {
  fetchResumes();
});

const createNewResume = async () => {
  if (!authStore.isLoggedIn) {
    const newId = `resume_${Date.now()}`;
    router.push(`/editor/${newId}`);
    return;
  }

  try {
    const res = await fetch('/api/resumes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        title: '未命名求职简历',
        templateId: 'classic'
      })
    });
    const data: any = await res.json();
    if (data.code === 0 && data.data?.id) {
      router.push(`/editor/${data.data.id}`);
    }
  } catch (err) {
    console.error(err);
    const newId = `resume_${Date.now()}`;
    router.push(`/editor/${newId}`);
  }
};

const duplicateResume = async (item: ResumeSummary) => {
  const copyId = `resume_${Date.now()}`;
  resumes.value.unshift({
    id: copyId,
    title: `${item.title}_副本`,
    templateId: item.templateId,
    updatedAt: Math.floor(Date.now() / 1000)
  });
};

const deleteResume = async (idx: number, id: string) => {
  if (!confirm('确认删除该简历吗？此操作不可撤销。')) return;

  if (authStore.isLoggedIn && id !== 'demo') {
    try {
      await fetch(`/api/resumes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authStore.token}` }
      });
    } catch (err) {
      console.error(err);
    }
  }
  resumes.value.splice(idx, 1);
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <Navbar />

    <main class="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-900">我的简历</h1>
          <p class="text-xs text-slate-500 mt-1">管理并制作您的多份针对性投递简历</p>
        </div>

        <button
          @click="createNewResume"
          class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-md shadow-blue-500/20 transition"
        >
          <Plus class="w-4 h-4" />
          <span>新建简历</span>
        </button>
      </div>

      <!-- 简历卡片网格 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- 新建卡片占位 -->
        <div
          @click="createNewResume"
          class="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] cursor-pointer transition group"
        >
          <div class="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition mb-3">
            <Plus class="w-6 h-6" />
          </div>
          <span class="text-xs font-bold text-slate-700 group-hover:text-blue-600">新建一份新简历</span>
          <span class="text-[11px] text-slate-400 mt-1">从空白或范文模板开始</span>
        </div>

        <!-- 简历列表卡片 -->
        <div
          v-for="(item, idx) in resumes"
          :key="item.id"
          class="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
        >
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase font-mono">
                {{ item.templateId }} 模板
              </span>
              <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                <button
                  @click="duplicateResume(item)"
                  class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50"
                  title="复制一份副本"
                >
                  <Copy class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="deleteResume(idx, item.id)"
                  class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                  title="删除"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <h3 class="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
              {{ item.title }}
            </h3>

            <div class="flex items-center gap-1.5 text-[11px] text-slate-400 mt-3 font-mono">
              <Clock class="w-3 h-3" />
              <span>更新于 {{ formatTime(item.updatedAt) }}</span>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <router-link
              :to="`/editor/${item.id}`"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Edit3 class="w-3.5 h-3.5" />
              <span>编辑简历</span>
            </router-link>

            <router-link
              :to="`/share/${item.id}`"
              class="text-xs text-slate-400 hover:text-slate-600"
            >
              查看只读页
            </router-link>
          </div>
        </div>
      </div>
    </main>

    <!-- 登录注册弹窗 -->
    <AuthModal
      :isOpen="isAuthModalOpen"
      @close="isAuthModalOpen = false"
      @success="fetchResumes"
    />
  </div>
</template>
