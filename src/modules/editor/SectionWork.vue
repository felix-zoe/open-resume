<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { WorkItem } from '../../types/resume';
import { Plus, Trash2, HelpCircle, ArrowUp, ArrowDown } from 'lucide-vue-next';

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

const moveWorkItem = (index: number, direction: 'up' | 'down') => {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target >= 0 && target < workModule.items.length) {
    const temp = workModule.items[index];
    workModule.items[index] = workModule.items[target];
    workModule.items[target] = temp;
  }
};

const insertSnippet = (item: WorkItem, templateText: string) => {
  if (!item.description || item.description.trim() === '') {
    item.description = templateText;
  } else {
    item.description += `\n${templateText}`;
  }
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
      <!-- 操作按钮组 -->
      <div class="absolute right-3 top-3 flex items-center gap-1">
        <button
          v-if="idx > 0"
          @click="moveWorkItem(idx, 'up')"
          title="上移此段经历"
          class="text-gray-400 hover:text-gray-700 transition p-1 rounded"
        >
          <ArrowUp class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="idx < workModule.items.length - 1"
          @click="moveWorkItem(idx, 'down')"
          title="下移此段经历"
          class="text-gray-400 hover:text-gray-700 transition p-1 rounded"
        >
          <ArrowDown class="w-3.5 h-3.5" />
        </button>
        <button
          @click="removeWorkItem(idx)"
          title="删除此段经历"
          class="text-gray-400 hover:text-rose-500 transition p-1 rounded ml-1"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

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

        <!-- 快捷 STAR 句式推荐 -->
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] text-gray-400">快捷句式:</span>
          <button
            type="button"
            @click="insertSnippet(item, '• 主导负责 [核心模块/系统]，攻关解决 [技术难点]，推动业务效率提升 [30%]。')"
            class="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 px-1.5 py-0.5 rounded transition"
          >
            + 主导推进与提效
          </button>
          <button
            type="button"
            @click="insertSnippet(item, '• 深度调优 [首屏加载/渲染性能]，核心交互卡顿率降低 [50%]，服务日常 [XX 万] 用户。')"
            class="text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded transition"
          >
            + 性能调优指标
          </button>
          <button
            type="button"
            @click="insertSnippet(item, '• 搭建跨团队 [通用组件库/规范底座]，支撑 [10+] 个核心业务线稳定平滑交付。')"
            class="text-[10px] text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 px-1.5 py-0.5 rounded transition"
          >
            + 规范底座支撑
          </button>
        </div>
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
