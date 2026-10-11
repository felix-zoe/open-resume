<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AuthModal from '../components/AuthModal.vue';
import { useAuthStore } from '../stores/auth';
import {
  Plus,
  Trash2,
  Copy,
  Edit3,
  Clock,
  Eye,
  Share2,
  TrendingUp,
  Download,
  X,
  ExternalLink,
  Activity
} from 'lucide-vue-next';

interface ResumeSummary {
  id: string;
  title: string;
  templateId: string;
  updatedAt: string | number;
  stats?: {
    totalViews: number;
    avgDuration: number;
    totalDownloads: number;
  };
}

const router = useRouter();
const authStore = useAuthStore();

const isAuthModalOpen = ref(false);
const resumes = ref<ResumeSummary[]>([
  {
    id: 'demo',
    title: '资深前端研发工程师-张小凡',
    templateId: 'classic',
    updatedAt: '本地示范',
    stats: { totalViews: 6, avgDuration: 42, totalDownloads: 2 }
  }
]);

// 访客足迹弹窗
const isAnalyticsModalOpen = ref(false);
const activeResumeForAnalytics = ref<ResumeSummary | null>(null);
const activeAnalyticsData = ref<any>(null);
const loadingAnalytics = ref(false);

const openAnalytics = async (item: ResumeSummary) => {
  activeResumeForAnalytics.value = item;
  isAnalyticsModalOpen.value = true;
  loadingAnalytics.value = true;

  if (item.id === 'demo' || !authStore.isLoggedIn) {
    activeAnalyticsData.value = {
      totalViews: item.stats?.totalViews || 6,
      avgDuration: item.stats?.avgDuration || 42,
      totalDownloads: item.stats?.totalDownloads || 2,
      recentVisits: [
        { id: '1', duration: 58, isDownloaded: 1, createdAt: Math.floor(Date.now() / 1000) - 3600 },
        { id: '2', duration: 35, isDownloaded: 0, createdAt: Math.floor(Date.now() / 1000) - 7200 },
        { id: '3', duration: 42, isDownloaded: 1, createdAt: Math.floor(Date.now() / 1000) - 86400 }
      ]
    };
    loadingAnalytics.value = false;
    return;
  }

  try {
    const res = await fetch(`/api/resumes/${item.id}/analytics`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    });
    const json: any = await res.json();
    if (json.code === 0 && json.data) {
      activeAnalyticsData.value = json.data;
    }
  } catch (err) {
    console.error('获取简历统计失败:', err);
  } finally {
    loadingAnalytics.value = false;
  }
};

// 格式化时间戳
const formatTime = (time: string | number) => {
  if (typeof time === 'number') {
    const d = new Date(time * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return time;
};

// 复制分享链接
const copyShareLink = (id: string) => {
  const url = `${window.location.origin}/share/${id}`;
  navigator.clipboard.writeText(url).then(() => {
    alert(`在线分享链接已复制：\n${url}`);
  }).catch(() => {
    alert(`链接：${url}`);
  });
};

// 拉取云端数据
const fetchResumes = async () => {
  if (!authStore.isLoggedIn) return;
  try {
    const res = await fetch('/api/resumes', {
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    });
    const data: any = await res.json();
    if (data.code === 0 && Array.isArray(data.data)) {
      resumes.value = data.data;

      // 异步抓取每份简历的基础访问数据
      for (const item of resumes.value) {
        fetch(`/api/resumes/${item.id}/analytics`, {
          headers: { Authorization: `Bearer ${authStore.token}` }
        }).then(r => r.json()).then((res: any) => {
          if (res.code === 0 && res.data) {
            item.stats = {
              totalViews: res.data.totalViews || 0,
              avgDuration: res.data.avgDuration || 0,
              totalDownloads: res.data.totalDownloads || 0
            };
          }
        }).catch(() => {});
      }
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
    updatedAt: Math.floor(Date.now() / 1000),
    stats: { totalViews: 0, avgDuration: 0, totalDownloads: 0 }
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
          <h1 class="text-xl sm:text-2xl font-bold text-slate-900">简历管理与投递看板</h1>
          <p class="text-xs text-slate-500 mt-1">管理针对不同企业与岗位的多份专属简历，掌控 HR 阅读反馈</p>
        </div>

        <button
          @click="createNewResume"
          class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
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
          class="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[230px] cursor-pointer transition group"
        >
          <div class="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition mb-3">
            <Plus class="w-6 h-6" />
          </div>
          <span class="text-xs font-bold text-slate-700 group-hover:text-blue-600">新建一份针对性简历</span>
          <span class="text-[11px] text-slate-400 mt-1">从范文或空白骨架开始制作</span>
        </div>

        <!-- 简历列表卡片 -->
        <div
          v-for="(item, idx) in resumes"
          :key="item.id"
          class="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
        >
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase font-mono">
                {{ item.templateId }} 模板
              </span>
              <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                <button
                  @click="copyShareLink(item.id)"
                  class="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50"
                  title="复制在线只读分享链接"
                >
                  <Share2 class="w-3.5 h-3.5" />
                </button>
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

            <!-- HR 阅读足迹统计指示器 -->
            <div
              @click="openAnalytics(item)"
              class="mt-3 p-2 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-100 flex items-center justify-between cursor-pointer transition"
              title="点击查看 HR 详细阅读足迹"
            >
              <div class="flex items-center gap-3 text-[11px] text-slate-600">
                <span class="flex items-center gap-1">
                  <Eye class="w-3.5 h-3.5 text-blue-500" />
                  <span class="font-bold font-mono">{{ item.stats?.totalViews ?? 0 }}</span> 浏览
                </span>
                <span class="flex items-center gap-1">
                  <Activity class="w-3.5 h-3.5 text-indigo-500" />
                  <span class="font-bold font-mono">{{ item.stats?.avgDuration ?? 0 }}s</span> 均长
                </span>
              </div>
              <span class="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5">
                <span>足迹</span>
                <TrendingUp class="w-3 h-3" />
              </span>
            </div>

            <div class="flex items-center gap-1.5 text-[11px] text-slate-400 mt-3 font-mono">
              <Clock class="w-3 h-3" />
              <span>更新于 {{ formatTime(item.updatedAt) }}</span>
            </div>
          </div>

          <div class="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
            <router-link
              :to="`/editor/${item.id}`"
              class="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
            >
              <Edit3 class="w-3.5 h-3.5" />
              <span>编辑排版</span>
            </router-link>

            <router-link
              :to="`/share/${item.id}`"
              target="_blank"
              class="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <span>在线只读页</span>
              <ExternalLink class="w-3 h-3" />
            </router-link>
          </div>
        </div>
      </div>
    </main>

    <!-- HR 阅读足迹详情弹窗 -->
    <div v-if="isAnalyticsModalOpen" class="fixed inset-0 z-50 overflow-y-auto no-print">
      <div @click="isAnalyticsModalOpen = false" class="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity"></div>
      <div class="min-h-full flex items-center justify-center p-4">
        <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Activity class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-900">投递阅读足迹 (HR Analytics)</h3>
                <p class="text-[11px] text-slate-400">{{ activeResumeForAnalytics?.title }}</p>
              </div>
            </div>
            <button @click="isAnalyticsModalOpen = false" class="p-1 text-slate-400 hover:text-slate-600">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- 核心指标大卡片 -->
          <div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
              <div class="text-[10px] text-slate-500">累计被查阅</div>
              <div class="text-xl font-black text-blue-600 font-mono mt-0.5">{{ activeAnalyticsData?.totalViews || 0 }} 次</div>
            </div>
            <div class="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div class="text-[10px] text-slate-500">平均停留时长</div>
              <div class="text-xl font-black text-indigo-600 font-mono mt-0.5">{{ activeAnalyticsData?.avgDuration || 0 }} 秒</div>
            </div>
            <div class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
              <div class="text-[10px] text-slate-500">被导出 PDF</div>
              <div class="text-xl font-black text-emerald-600 font-mono mt-0.5">{{ activeAnalyticsData?.totalDownloads || 0 }} 次</div>
            </div>
          </div>

          <!-- 最近访问流水 -->
          <div>
            <h4 class="text-xs font-bold text-slate-700 mb-2">最近 HR 打开记录</h4>
            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="v in (activeAnalyticsData?.recentVisits || [])"
                :key="v.id"
                class="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
              >
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full" :class="v.isDownloaded ? 'bg-emerald-500' : 'bg-blue-500'"></span>
                  <span class="text-slate-600">{{ formatTime(v.createdAt) }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-slate-500 font-mono">阅读停留 {{ v.duration }}s</span>
                  <span v-if="v.isDownloaded" class="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                    <Download class="w-3 h-3" /> 已下载
                  </span>
                </div>
              </div>
              <div v-if="!activeAnalyticsData?.recentVisits?.length" class="text-center py-6 text-xs text-slate-400">
                暂无阅读记录，将在线链接发送给 HR 即可实时追踪阅读时长！
              </div>
            </div>
          </div>

          <div class="pt-2">
            <button
              @click="isAnalyticsModalOpen = false"
              class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 登录注册弹窗 -->
    <AuthModal
      :isOpen="isAuthModalOpen"
      @close="isAuthModalOpen = false"
      @success="fetchResumes"
    />
  </div>
</template>
