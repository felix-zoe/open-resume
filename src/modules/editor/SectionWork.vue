<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { WorkItem } from '../../types/resume';
import { Plus, Trash2, HelpCircle, ArrowUp, ArrowDown, Copy } from 'lucide-vue-next';
import MonthPicker from '../../components/editor/MonthPicker.vue';
import BulletEditor from '../../components/editor/BulletEditor.vue';

const resumeStore = useResumeStore();
const workModule = computed(() => resumeStore.content.modules.work);

const addWorkItem = () => {
  const newItem: WorkItem = {
    id: `work-${Date.now()}`,
    company: '',
    department: '',
    position: '',
    startDate: '',
    endDate: '至今',
    // 不再预填「负责...」这类占位句式：用户往往直接提交，
    // 结果简历上留着一句没改的空话
    description: ''
  };
  workModule.value.items.push(newItem);
};

const removeWorkItem = (index: number) => {
  workModule.value.items.splice(index, 1);
};

const moveWorkItem = (index: number, direction: 'up' | 'down') => {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target >= 0 && target < workModule.value.items.length) {
    const temp = workModule.value.items[index];
    workModule.value.items[index] = workModule.value.items[target];
    workModule.value.items[target] = temp;
  }
};

/** 复制一条经历：常见于同公司内换岗，逐字段重填太浪费 */
const duplicateWorkItem = (index: number) => {
  const source = workModule.value.items[index];
  const copy: WorkItem = {
    ...JSON.parse(JSON.stringify(source)),
    id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  };
  workModule.value.items.splice(index + 1, 0, copy);
};
</script>

<template>
  <div class="space-y-4">
    <!-- 经历列表 -->
    <div
      v-for="(item, idx) in workModule.items"
      :key="item.id"
      class="bg-slate-50/70 p-3 rounded-lg border border-slate-200 relative group transition hover:border-slate-300"
    >
      <!-- 操作按钮组 -->
      <div class="absolute right-3 top-3 flex items-center gap-1">
        <button
          v-if="idx > 0"
          @click="moveWorkItem(idx, 'up')"
          title="上移此段经历"
          aria-label="上移此段经历"
          class="text-slate-500 hover:text-slate-800 transition p-1 rounded"
        >
          <ArrowUp class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="idx < workModule.items.length - 1"
          @click="moveWorkItem(idx, 'down')"
          title="下移此段经历"
          aria-label="下移此段经历"
          class="text-slate-500 hover:text-slate-800 transition p-1 rounded"
        >
          <ArrowDown class="w-3.5 h-3.5" />
        </button>
        <button
          @click="duplicateWorkItem(idx)"
          title="复制此段经历"
          aria-label="复制此段经历"
          class="text-slate-500 hover:text-slate-800 transition p-1 rounded"
        >
          <Copy class="w-3.5 h-3.5" />
        </button>
        <button
          @click="removeWorkItem(idx)"
          title="删除此段经历"
          aria-label="删除此段经历"
          class="text-slate-500 hover:text-danger-600 transition p-1 rounded ml-1"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5 pr-8">
        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">公司名称 *</label>
          <input
            type="text"
            v-model="item.company"
            placeholder="如：腾讯科技 (深圳) 有限公司"
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">职位头衔 *</label>
          <input
            type="text"
            v-model="item.position"
            placeholder="如：高级前端工程师"
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-2xs font-medium text-slate-500 mb-0.5">所属部门 (选填)</label>
          <input
            type="text"
            v-model="item.department"
            placeholder="如：云与智慧产业事业群"
            class="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <MonthPicker v-model="item.startDate" label="开始时间" />
          <MonthPicker v-model="item.endDate" label="结束时间" allow-present />
        </div>
      </div>

      <!-- 工作内容 (带 STAR 法则提示) -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-2xs font-medium text-slate-600 flex items-center gap-1">
            <span>工作内容与业绩产出</span>
          </label>
          <span class="text-2xs text-primary-600 flex items-center gap-0.5" title="STAR法则：情境(Situation) + 任务(Task) + 行动(Action) + 结果(Result)">
            <HelpCircle class="w-3 h-3" /> 建议采用 STAR 法则，分点量化描述
          </span>
        </div>
        <BulletEditor v-model="item.description" />
      </div>
    </div>

    <!-- 添加按钮 -->
    <button
      @click="addWorkItem"
      class="w-full py-2 border-2 border-dashed border-slate-300 hover:border-primary-500 hover:bg-primary-50/40 text-slate-600 hover:text-primary-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一段工作经历</span>
    </button>
  </div>
</template>
