<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { Plus, Trash2 } from 'lucide-vue-next';
import type { SkillDisplayType } from '../../../shared/types';

const resumeStore = useResumeStore();
const skillsModule = computed(() => resumeStore.content.modules.skills);

/**
 * 技能形态（TPL-04）。
 *
 * 两种形态共用同一份 `items`，切换只是改渲染方式：
 * 用户不需要为了换个样子重新录一遍技能。
 */
const displayType = computed<SkillDisplayType>(() => skillsModule.value.type ?? 'sentence');

const TYPE_OPTIONS: Array<{ value: SkillDisplayType; label: string; hint: string }> = [
  { value: 'sentence', label: '整句描述', hint: '逐行列出，适合写「熟练运用 X 解决 Y」' },
  { value: 'tag', label: '标签胶囊', hint: '短词堆叠，适合 Vue3 / TypeScript / Vite' }
];

function setDisplayType(value: SkillDisplayType) {
  skillsModule.value.type = value;
}

const addSkill = () => {
  skillsModule.value.items.push('');
};

const removeSkill = (index: number) => {
  skillsModule.value.items.splice(index, 1);
};
</script>

<template>
  <div class="space-y-3">
    <!-- 形态切换 -->
    <div>
      <label class="block text-2xs font-medium text-slate-500 mb-1">呈现形态</label>
      <div class="grid grid-cols-2 gap-2" role="group" aria-label="技能呈现形态">
        <button
          v-for="option in TYPE_OPTIONS"
          :key="option.value"
          type="button"
          class="px-2.5 py-1.5 rounded-lg border text-left transition"
          :class="
            displayType === option.value
              ? 'border-primary-500 bg-primary-50/60 text-primary-700'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          "
          :aria-pressed="displayType === option.value"
          @click="setDisplayType(option.value)"
        >
          <span class="block text-xs font-bold">{{ option.label }}</span>
          <span class="block text-2xs text-slate-500 mt-0.5 leading-snug">{{ option.hint }}</span>
        </button>
      </div>
      <p v-if="displayType === 'tag'" class="text-2xs text-slate-500 mt-1.5">
        标签形态下每条建议不超过 12 个字，否则会换行显得凌乱
      </p>
    </div>

    <p class="text-2xs text-slate-500">
      {{
        displayType === 'tag'
          ? '一行一个技能词，预览里会渲染成胶囊标签。'
          : '建议按照“技术栈掌握程度 + 适用场景”条理陈述（如精通 Vue3、深入理解浏览器原理等）。'
      }}
    </p>

    <div v-for="(_, idx) in skillsModule.items" :key="idx" class="flex items-center gap-2">
      <span class="text-xs font-mono text-slate-400 w-4 text-right">{{ idx + 1 }}.</span>
      <input
        type="text"
        v-model="skillsModule.items[idx]"
        :placeholder="displayType === 'tag' ? '如：TypeScript' : '输入一项专业技能描述...'"
        class="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded focus:border-primary-500 outline-none"
      />
      <button
        @click="removeSkill(idx)"
        class="text-slate-400 hover:text-rose-500 p-1.5 rounded transition"
        title="删除此项技能"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <button
      @click="addSkill"
      class="w-full py-2 border-2 border-dashed border-slate-300 hover:border-primary-500 hover:bg-primary-50/40 text-slate-600 hover:text-primary-600 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
    >
      <Plus class="w-4 h-4" />
      <span>添加一条技能</span>
    </button>
  </div>
</template>
