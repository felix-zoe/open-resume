<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { EducationItem } from '../../types/resume';
import { Plus, Trash2 } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const eduModule = resumeStore.content.modules.education;

const addEduItem = () => {
  const newItem: EducationItem = {
    id: `edu-${Date.now()}`,
    school: '',
    major: '',
    degree: '本科',
    startDate: '',
    endDate: '',
    description: ''
  };
  eduModule.items.push(newItem);
};

const removeEduItem = (index: number) => {
  eduModule.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="(item, idx) in eduModule.items"
      :key="item.id"
      class="bg-gray-50/70 p-3 rounded-lg border border-gray-200 relative group transition hover:border-gray-300"
    >
      <button
        @click="removeEduItem(idx)"
        title="删除此段教育"
        class="absolute right-3 top-3 text-gray-400 hover:text-rose-500 transition p-1 rounded"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5 pr-8">
        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">学校名称 *</label>
          <input
            type="text"
            v-model="item.school"
            placeholder="如：北京航空航天大学"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">主修专业 *</label>
          <input
            type="text"
            v-model="item.major"
            placeholder="如：软件工程"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">学历层次</label>
          <select
            v-model="item.degree"
            class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          >
            <option value="大专">大专</option>
            <option value="本科">本科</option>
            <option value="硕士">硕士</option>
            <option value="博士">博士</option>
            <option value="MBA">MBA</option>
            <option value="其他">其他</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">入学时间</label>
            <input
              type="text"
              v-model="item.startDate"
              placeholder="2018.09"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-gray-500 mb-0.5">毕业时间</label>
            <input
              type="text"
              v-model="item.endDate"
              placeholder="2022.06"
              class="w-full px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-medium text-gray-500 mb-0.5">荣誉/绩点/课程 (选填)</label>
          <input
            type="text"
            v-model="item.description"
            placeholder="如：GPA 3.8/4.0 (前 5%)，国家奖学金"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
          />
        </div>
      </div>
    </div>

    <button
      @click="addEduItem"
      class="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一段教育背景</span>
    </button>
  </div>
</template>
