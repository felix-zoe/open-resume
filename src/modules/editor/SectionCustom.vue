<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { Plus, Trash2 } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const customModule = resumeStore.content.modules.custom;

const addItem = () => {
  customModule.items.push('');
};

const removeItem = (index: number) => {
  customModule.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-3">
    <!-- 模块自定义标题 -->
    <div>
      <label class="block text-[11px] font-medium text-gray-600 mb-1">自定义模块标题</label>
      <input
        type="text"
        v-model="customModule.title"
        placeholder="如：荣誉奖项 / 资格证书 / 自我评价"
        class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
      />
    </div>

    <!-- 条目列表 -->
    <div v-for="(_, idx) in customModule.items" :key="idx" class="flex items-center gap-2">
      <span class="text-xs font-mono text-gray-400 w-4 text-right">{{ idx + 1 }}.</span>
      <input
        type="text"
        v-model="customModule.items[idx]"
        placeholder="输入条目描述..."
        class="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
      />
      <button
        @click="removeItem(idx)"
        class="text-gray-400 hover:text-rose-500 p-1.5 rounded transition"
        title="删除"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <button
      @click="addItem"
      class="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一条自定义内容</span>
    </button>
  </div>
</template>
