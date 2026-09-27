<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { WorkItem } from '../../types/resume';
import { Plus, Trash2, HelpCircle } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const workModule = resumeStore.content.modules.work;

const addWorkItem = () => {
  const newItem: WorkItem = {
    id: `work-${Date.now()}`,
    company: '',
    department: '',
    position: '',
    startDate: '',
    endDate: '至今',
    description: '• 负责...\n• 达成...'
  };
  workModule.items.push(newItem);
};

const removeWorkItem = (index: number) => {
  workModule.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4">
    <!-- 经历列表 -->
    <div
      v-for="(item, idx) in workModule.items"
      :key="item.id"
      class="bg-gray-50/70 p-3 rounded-lg border border-gray-200 relative group transition hover:border-gray-300"
    >
      <!-- 删除按钮 -->
      <button
        @click="removeWorkItem(idx)"
        title="删除此段经历"
        class="absolute right-3 top-3 text-gray-400 hover:text-rose-500 transition p-1 rounded"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5 pr-8">
        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">公司名称 *</label>
          <input
            type="text"
            v-model="item.company"
            placeholder="如：腾讯科技 (深圳) 有限公司"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">职位头衔 *</label>
          <input
            type="text"
            v-model="item.position"
            placeholder="如：高级前端工程师"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">所属部门 (选填)</label>
          <input
            type="text"
            v-model="item.department"
            placeholder="如：云与智慧产业事业群"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">开始时间</label>
            <input
              type="text"
              v-model="item.startDate"
              placeholder="2022.07"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">结束时间</label>
            <input
              type="text"
              v-model="item.endDate"
              placeholder="至今 / 2024.03"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <!-- 工作内容 (带 STAR 法则提示) -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-[11px] font-medium text-gray-600 flex items-center gap-1">
            <span>工作内容与业绩产出</span>
          </label>
          <span class="text-[10px] text-blue-600 flex items-center gap-0.5" title="STAR法则：情境(Situation) + 任务(Task) + 行动(Action) + 结果(Result)">
            <HelpCircle class="w-3 h-3" /> 建议采用 STAR 法则，分点量化描述
          </span>
        </div>
        <textarea
          v-model="item.description"
          rows="3"
          placeholder="• 负责...，主导使用某技术解决某问题；&#10;• 达成...量化结果（如性能提升30%，服务亿级PV）。"
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none font-sans leading-relaxed"
        ></textarea>
      </div>
    </div>

    <!-- 添加按钮 -->
    <button
      @click="addWorkItem"
      class="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一段工作经历</span>
    </button>
  </div>
</template>
