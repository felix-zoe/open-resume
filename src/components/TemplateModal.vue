<script setup lang="ts">
import { computed } from 'vue';
import { useResumeStore } from '../stores/resume';
import { TEMPLATES } from '../constants/templates';
import { Check } from 'lucide-vue-next';
import { AppModal, cx } from './ui';
import TemplatePreview from './home/TemplatePreview.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const resumeStore = useResumeStore();

const open = computed({
  get: () => props.isOpen,
  set: (value: boolean) => {
    if (!value) emit('close');
  }
});

const selectTemplate = (id: string) => {
  resumeStore.templateId = id;
  emit('close');
};
</script>

<template>
  <AppModal
    v-model:open="open"
    size="lg"
    title="选择简历排版模板"
    description="切换模板不会丢失或改变任何已填写的内容"
  >
    <div class="space-y-2.5">
      <button
        v-for="tpl in TEMPLATES"
        :key="tpl.id"
        type="button"
        class="w-full text-left p-4 rounded-xl border-2 transition flex items-start gap-4 hover:border-primary-400"
        :class="
          resumeStore.templateId === tpl.id
            ? 'border-primary-500 bg-primary-50/40'
            : 'border-slate-200 bg-white'
        "
        :aria-pressed="resumeStore.templateId === tpl.id"
        @click="selectTemplate(tpl.id)"
      >
        <!-- 真实模板缩略图：与首页共用 TemplatePreview，不再画骨架图 -->
        <div class="w-14 h-20 flex-shrink-0 rounded border border-slate-200 overflow-hidden">
          <TemplatePreview :template-id="tpl.id" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-slate-900">{{ tpl.name }}</h3>
            <span class="text-2xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {{ tpl.tag }}
            </span>
          </div>
          <p class="text-2xs text-slate-500 mt-1 leading-relaxed">{{ tpl.description }}</p>
        </div>

        <span
          class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          :class="
            cx(
              resumeStore.templateId === tpl.id
                ? 'bg-primary-500 text-white'
                : 'border border-slate-300 text-transparent'
            )
          "
          aria-hidden="true"
        >
          <Check class="w-3 h-3" />
        </span>
      </button>
    </div>
  </AppModal>
</template>
