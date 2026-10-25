<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { ProjectItem } from '../../types/resume';
import { Plus, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-vue-next';
import MonthPicker from '../../components/editor/MonthPicker.vue';
import BulletEditor from '../../components/editor/BulletEditor.vue';

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
    description: ''
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

/** 复制一个项目：同系列产品的多个版本常常只需改名称与指标 */
const duplicateProjectItem = (index: number) => {
  const source = projectModule.value.items[index];
  const copy: ProjectItem = {
    ...JSON.parse(JSON.stringify(source)),
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  };
  projectModule.value.items.splice(index + 1, 0, copy);
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
          @click="duplicateProjectItem(idx)"
          title="复制此项目"
          aria-label="复制此项目"
          class="text-slate-500 hover:text-slate-800 transition p-1 rounded"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>
        <button
          @click="removeProjectItem(idx)"
          title="删除此项目"
          aria-label="删除此项目"
          class="text-slate-500 hover:text-danger-600 transition p-1 rounded ml-1"
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
          <MonthPicker v-model="item.startDate" label="开始时间" />
          <MonthPicker v-model="item.endDate" label="结束时间" allow-present />
        </div>
      </div>

      <div>
        <label class="block text-2xs font-medium text-slate-600 mb-1">项目描述与个人贡献</label>
        <BulletEditor v-model="item.description" placeholder="一条一条写：项目难点、你的方案、带来的收益（带数字）" />
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
