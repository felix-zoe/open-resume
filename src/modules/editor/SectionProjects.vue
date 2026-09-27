<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { ProjectItem } from '../../types/resume';
import { Plus, Trash2 } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const projectModule = resumeStore.content.modules.projects;

const addProjectItem = () => {
  const newItem: ProjectItem = {
    id: `proj-${Date.now()}`,
    name: '',
    role: '',
    startDate: '',
    endDate: '至今',
    link: '',
    description: '• 项目背景：...\n• 核心职责与贡献：...'
  };
  projectModule.items.push(newItem);
};

const removeProjectItem = (index: number) => {
  projectModule.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(item, idx) in projectModule.items"
      :key="item.id"
      class="bg-gray-50/70 p-3 rounded-lg border border-gray-200 relative group transition hover:border-gray-300"
    >
      <button
        @click="removeProjectItem(idx)"
        title="删除此项目"
        class="absolute right-3 top-3 text-gray-400 hover:text-rose-500 transition p-1 rounded"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5 pr-8">
        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">项目名称 *</label>
          <input
            type="text"
            v-model="item.name"
            placeholder="如：企业级低代码可视化平台"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">担任角色</label>
          <input
            type="text"
            v-model="item.role"
            placeholder="如：前端负责人 / 核心开发"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">项目演示/代码链接 (可选)</label>
          <input
            type="text"
            v-model="item.link"
            placeholder="https://..."
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">开始时间</label>
            <input
              type="text"
              v-model="item.startDate"
              placeholder="2023.01"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">结束时间</label>
            <input
              type="text"
              v-model="item.endDate"
              placeholder="2023.10"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label class="block text-[11px] font-medium text-gray-600 mb-1">项目描述与个人贡献</label>
        <textarea
          v-model="item.description"
          rows="3"
          placeholder="介绍项目定位、采用的技术方案及攻坚的技术难点与收益..."
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none font-sans leading-relaxed"
        ></textarea>
      </div>
    </div>

    <button
      @click="addProjectItem"
      class="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一个项目经历</span>
    </button>
  </div>
</template>
