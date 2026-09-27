<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { Plus, Trash2 } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const skillsModule = resumeStore.content.modules.skills;

const addSkill = () => {
  skillsModule.items.push('');
};

const removeSkill = (index: number) => {
  skillsModule.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-3">
    <p class="text-[11px] text-gray-500">
      建议按照“技术栈掌握程度 + 适用场景”条理陈述（如精通 Vue3、深入理解浏览器原理等）。
    </p>

    <div v-for="(_, idx) in skillsModule.items" :key="idx" class="flex items-center gap-2">
      <span class="text-xs font-mono text-gray-400 w-4 text-right">{{ idx + 1 }}.</span>
      <input
        type="text"
        v-model="skillsModule.items[idx]"
        placeholder="输入一项专业技能描述..."
        class="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 outline-none"
      />
      <button
        @click="removeSkill(idx)"
        class="text-gray-400 hover:text-rose-500 p-1.5 rounded transition"
        title="删除此项技能"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <button
      @click="addSkill"
      class="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-600 hover:text-blue-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一条技能</span>
    </button>
  </div>
</template>
