<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { ProjectItem } from '../../types/resume';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const projectModule = computed(() => resumeStore.content.modules.projects);

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
  projectModule.value.items.push(newItem);
};

const removeProjectItem = (index: number) => {
  projectModule.value.items.splice(index, 1);
};

const moveProjectItem = (index: number, direction: 'up' | 'down') => {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target >= 0 && target < projectModule.value.items.length) {
    const temp = projectModule.value.items[index];
    projectModule.value.items[index] = projectModule.value.items[target];
    projectModule.value.items[target] = temp;
  }
};

const insertSnippet = (item: ProjectItem, templateText: string) => {
  if (!item.description || item.description.trim() === '') {
    item.description = templateText;
  } else {
    item.description += `\n${templateText}`;
  }
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(item, idx) in projectModule.items"
      :key="item.id"
      class="bg-slate-50/70 p-3 rounded-lg border border-slate-200 relative group transition hover:border-slate-300"
    >
      <!-- 操作按钮组 -->
      <div class="absolute right-3 top-3 flex items-center gap-1">
        <button
          v-if="idx > 0"
          @click="moveProjectItem(idx, 'up')"
          title="上移此项目"
          class="text-slate-400 hover:text-slate-700 transition p-1 rounded"
        >
          <ArrowUp class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="idx < projectModule.items.length - 1"
          @click="moveProjectItem(idx, 'down')"
          title="下移此项目"
          class="text-slate-400 hover:text-slate-700 transition p-1 rounded"
        >
          <ArrowDown class="w-3.5 h-3.5" />
        </button>
        <button
          @click="removeProjectItem(idx)"
          title="删除此项目"
          class="text-slate-400 hover:text-rose-500 transition p-1 rounded ml-1"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5 pr-8">
        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">项目名称 *</label>
          <input
            type="text"
            v-model="item.name"
            placeholder="如：企业级低代码可视化平台"
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">担任角色</label>
          <input
            type="text"
            v-model="item.role"
            placeholder="如：前端负责人 / 核心开发"
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">项目演示/代码链接 (可选)</label>
          <input
            type="text"
            v-model="item.link"
            placeholder="https://..."
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <label class="block text-2xs font-medium text-slate-500 mb-0.5">开始时间</label>
            <input
              type="text"
              v-model="item.startDate"
              placeholder="2023.01"
              class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-2xs font-medium text-slate-500 mb-0.5">结束时间</label>
            <input
              type="text"
              v-model="item.endDate"
              placeholder="2023.10"
              class="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label class="block text-2xs font-medium text-slate-600 mb-1">项目描述与个人贡献</label>
        <textarea
          v-model="item.description"
          rows="3"
          placeholder="介绍项目定位、采用的技术方案及攻坚的技术难点与收益..."
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none font-sans leading-relaxed"
        ></textarea>

        <!-- 快捷项目句式推荐 -->
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span class="text-2xs text-slate-400">快捷句式:</span>
          <button
            type="button"
            @click="insertSnippet(item, '• 项目难点：面对 [高并发/复杂交互/海量数据] 挑战，设计并落地 [架构方案]。')"
            class="text-2xs text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200/60 px-1.5 py-0.5 rounded transition"
          >
            + 架构难点攻关
          </button>
          <button
            type="button"
            @click="insertSnippet(item, '• 核心收益：项目上线后支撑 [XX] 业务场景，交付周期缩短 [40%]，好评率达 [98%]。')"
            class="text-2xs text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-200/60 px-1.5 py-0.5 rounded transition"
          >
            + 量化业务收益
          </button>
        </div>
      </div>
    </div>

    <button
      @click="addProjectItem"
      class="w-full py-2 border-2 border-dashed border-slate-300 hover:border-primary-500 hover:bg-primary-50/40 text-slate-600 hover:text-primary-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一个项目经历</span>
    </button>
  </div>
</template>
