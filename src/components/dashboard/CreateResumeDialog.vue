<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ArrowLeft, Check, Sparkles } from 'lucide-vue-next';
import { AppButton, AppInput, AppModal, FormField } from '../ui';
import { TEMPLATES, findTemplate } from '../../constants/templates';

const props = defineProps<{
  open: boolean;
  /** 游客：选完模板直接进编辑器本地草稿，不需要命名 */
  guest?: boolean;
  creating?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'create', payload: { templateId: string; title: string }): void;
  (e: 'guest-next', payload: { templateId: string }): void;
}>();

const step = ref<1 | 2 | 3>(1);
const templateId = ref(TEMPLATES[0].id);
const title = ref('未命名求职简历');
const titleTouched = ref(false);

const selected = computed(() => findTemplate(templateId.value));
const titleError = computed(() => {
  if (!titleTouched.value) return undefined;
  const value = title.value.trim();
  if (!value) return '请填写简历名称';
  if (value.length > 100) return '名称不能超过 100 个字符';
  return undefined;
});

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

function reset() {
  step.value = 1;
  templateId.value = TEMPLATES[0].id;
  title.value = '未命名求职简历';
  titleTouched.value = false;
}

watch(
  () => props.open,
  (open) => {
    if (open) reset();
  }
);

function next() {
  if (step.value === 1) {
    if (props.guest) {
      emit('guest-next', { templateId: templateId.value });
      emit('update:open', false);
      return;
    }
    step.value = 2;
    return;
  }
  if (step.value === 2) {
    titleTouched.value = true;
    if (titleError.value || !title.value.trim()) return;
    step.value = 3;
  }
}

function submit() {
  if (props.guest) {
    emit('guest-next', { templateId: templateId.value });
    return;
  }
  titleTouched.value = true;
  if (titleError.value || !title.value.trim()) {
    step.value = 2;
    return;
  }
  emit('create', { templateId: templateId.value, title: title.value.trim() });
}

const stepLabel = computed(() => (props.guest ? '选择模板' : `第 ${step.value} / 3 步`));
</script>

<template>
  <AppModal
    v-model:open="openModel"
    size="lg"
    :title="guest ? '选择模板开始制作' : '新建一份简历'"
    :close-on-overlay="!creating"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span class="text-2xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          {{ stepLabel }}
        </span>
        <h2 class="text-sm font-bold text-slate-900">
          {{ guest ? '选择模板开始制作' : '新建一份简历' }}
        </h2>
      </div>
      <p class="text-2xs text-slate-500 mt-1">
        {{ guest ? '无需注册即可编辑，登录后可保存到云端' : '模板随时可切换，不会丢失已填写的内容' }}
      </p>
    </template>

    <!-- 第 1 步：模板 -->
    <div v-if="step === 1" class="space-y-2.5">
      <button
        v-for="tpl in TEMPLATES"
        :key="tpl.id"
        type="button"
        class="w-full text-left p-3.5 rounded-xl border-2 transition flex items-start gap-3.5"
        :class="
          templateId === tpl.id
            ? 'border-primary-500 bg-primary-50/40'
            : 'border-slate-200 bg-white hover:border-slate-300'
        "
        :aria-pressed="templateId === tpl.id"
        @click="templateId = tpl.id"
      >
        <div
          class="w-10 h-14 rounded border border-slate-300 flex-shrink-0 flex flex-col p-1 gap-1 shadow-2xs"
          :class="tpl.accent"
          aria-hidden="true"
        >
          <div class="h-1.5 bg-slate-400/60 rounded-xs w-3/4 mx-auto" />
          <div class="h-1 bg-slate-300/60 rounded-xs w-full" />
          <div class="h-1 bg-slate-300/60 rounded-xs w-5/6" />
          <div class="h-1 bg-slate-300/60 rounded-xs w-4/5" />
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
          :class="templateId === tpl.id ? 'bg-primary-500 text-white' : 'border border-slate-300 text-transparent'"
          aria-hidden="true"
        >
          <Check class="w-3 h-3" />
        </span>
      </button>
    </div>

    <!-- 第 2 步：命名 -->
    <div v-else-if="step === 2" class="space-y-4">
      <FormField
        label="简历名称"
        id="create-resume-title"
        required
        hint="建议写成「岗位 + 姓名」，方便在列表中区分不同投递版本"
        :error="titleError"
      >
        <template #default="{ id, describedBy, invalid }">
          <AppInput
            :id="id"
            v-model="title"
            placeholder="如：前端工程师-张小凡"
            :invalid="invalid"
            :aria-describedby="describedBy"
            @blur="titleTouched = true"
            @keydown.enter.prevent="next"
          />
        </template>
      </FormField>

      <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-2xs text-slate-500 leading-relaxed">
        将使用
        <span class="font-semibold text-slate-700">{{ selected.shortName }}</span>
        模板。之后可以随时在编辑器右上角切换模板，内容不会丢失。
      </div>
    </div>

    <!-- 第 3 步：确认 -->
    <div v-else class="space-y-3">
      <div class="p-4 rounded-xl border border-slate-200 bg-white">
        <div class="text-2xs text-slate-500">即将创建</div>
        <div class="text-sm font-bold text-slate-900 mt-1 truncate">{{ title.trim() }}</div>
        <div class="flex items-center gap-2 mt-2 text-2xs text-slate-500">
          <span class="font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {{ selected.shortName }}
          </span>
          <span>· 默认不公开，分享链接需手动开启</span>
        </div>
      </div>
      <p class="text-2xs text-slate-500 leading-relaxed">
        创建后会自动保存，并打开编辑器。你可以先填写内容，随时导出 PDF。
      </p>
    </div>

    <template #footer>
      <AppButton
        v-if="step > 1"
        variant="ghost"
        :disabled="creating"
        @click="step = (step - 1) as 1 | 2"
      >
        <template #icon>
          <ArrowLeft class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>上一步</span>
      </AppButton>
      <AppButton variant="ghost" :disabled="creating" @click="emit('update:open', false)">
        取消
      </AppButton>
      <AppButton
        v-if="step < 3 || guest"
        :loading="creating"
        @click="next"
      >
        <template #icon>
          <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>{{ guest ? '开始制作' : '下一步' }}</span>
      </AppButton>
      <AppButton v-else :loading="creating" @click="submit">
        <template #icon>
          <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>创建并编辑</span>
      </AppButton>
    </template>
  </AppModal>
</template>
