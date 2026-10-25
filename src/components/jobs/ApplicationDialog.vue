<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { AppButton, AppInput, AppModal, AppSelect, AppTextarea, FormField } from '../ui';
import {
  APPLICATION_CHANNELS,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type JobApplication
} from '../../../shared/types';

/**
 * 新增 / 编辑投递记录。
 *
 * 日期用原生 `date` 输入：投递记录只需要「哪一天」，不需要精确到分钟，
 * 自己写一个日期选择器反而会在手机上更难用。
 */
const props = defineProps<{
  open: boolean;
  /** 编辑时传入；为空表示新增 */
  item?: JobApplication | null;
  /** 可关联的简历 */
  resumes?: Array<{ id: string; title: string }>;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'submit', payload: Record<string, unknown>): void;
}>();

const company = ref('');
const position = ref('');
const location = ref('');
const channel = ref('');
const status = ref<ApplicationStatus>('applied');
const resumeId = ref('');
const appliedAt = ref('');
const nextActionAt = ref('');
const nextActionNote = ref('');
const salaryRange = ref('');
const jobUrl = ref('');
const notes = ref('');
const touched = ref(false);

const isEdit = computed(() => Boolean(props.item));

const statusOptions = APPLICATION_STATUSES.map((value) => ({
  value,
  label: APPLICATION_STATUS_LABELS[value]
}));

const channelOptions = [
  { value: '', label: '未填写' },
  ...APPLICATION_CHANNELS.map((value) => ({ value, label: value }))
];

const resumeOptions = computed(() => [
  { value: '', label: '不关联简历' },
  ...(props.resumes ?? []).map((item) => ({ value: item.id, label: item.title }))
]);

/** 秒级时间戳 ↔ `<input type="date">` 的 YYYY-MM-DD（按本地时区，不引入时区偏移） */
function toDateInput(seconds?: number | null): string {
  if (!seconds) return '';
  const date = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInput(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
}

const companyError = computed(() =>
  touched.value && !company.value.trim() ? '请填写公司名称' : undefined
);
const positionError = computed(() =>
  touched.value && !position.value.trim() ? '请填写岗位名称' : undefined
);

function reset() {
  const item = props.item;
  company.value = item?.company ?? '';
  position.value = item?.position ?? '';
  location.value = item?.location ?? '';
  channel.value = item?.channel ?? '';
  status.value = item?.status ?? 'applied';
  resumeId.value = item?.resumeId ?? '';
  appliedAt.value = toDateInput(item?.appliedAt);
  nextActionAt.value = toDateInput(item?.nextActionAt);
  nextActionNote.value = item?.nextActionNote ?? '';
  salaryRange.value = item?.salaryRange ?? '';
  jobUrl.value = item?.jobUrl ?? '';
  notes.value = item?.notes ?? '';
  touched.value = false;
}

// 每次打开都重新初始化：编辑不同记录时不能残留上一条的内容
watch(
  () => props.open,
  (open) => {
    if (open) reset();
  },
  { immediate: true }
);

function handleSubmit() {
  touched.value = true;
  if (!company.value.trim() || !position.value.trim()) return;

  emit('submit', {
    company: company.value.trim(),
    position: position.value.trim(),
    location: location.value.trim(),
    channel: channel.value,
    status: status.value,
    resumeId: resumeId.value || null,
    appliedAt: fromDateInput(appliedAt.value),
    nextActionAt: fromDateInput(nextActionAt.value),
    nextActionNote: nextActionNote.value.trim(),
    salaryRange: salaryRange.value.trim(),
    jobUrl: jobUrl.value.trim(),
    notes: notes.value.trim()
  });
}
</script>

<template>
  <AppModal
    :open="open"
    :title="isEdit ? '编辑投递记录' : '添加投递记录'"
    size="md"
    @update:open="emit('update:open', $event)"
  >
    <form id="job-form" class="space-y-3.5" @submit.prevent="handleSubmit">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="公司" id="job-company" required :error="companyError">
          <template #default="{ id, describedBy, invalid }">
            <AppInput
              :id="id"
              v-model="company"
              placeholder="如：某互联网公司"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <FormField label="岗位" id="job-position" required :error="positionError">
          <template #default="{ id, describedBy, invalid }">
            <AppInput
              :id="id"
              v-model="position"
              placeholder="如：高级前端工程师"
              :invalid="invalid"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="城市" id="job-location">
          <template #default="{ id }">
            <AppInput :id="id" v-model="location" placeholder="如：北京" />
          </template>
        </FormField>

        <FormField label="投递渠道" id="job-channel">
          <template #default="{ id }">
            <AppSelect :id="id" v-model="channel" :options="channelOptions" aria-label="投递渠道" />
          </template>
        </FormField>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="状态" id="job-status">
          <template #default="{ id }">
            <AppSelect
              :id="id"
              :model-value="status"
              :options="statusOptions"
              aria-label="投递状态"
              @update:model-value="status = $event as ApplicationStatus"
            />
          </template>
        </FormField>

        <FormField label="关联简历" id="job-resume" hint="用于统计「哪种版本更容易进面试」">
          <template #default="{ id, describedBy }">
            <AppSelect
              :id="id"
              v-model="resumeId"
              :options="resumeOptions"
              aria-label="关联简历"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="投递日期" id="job-applied-at">
          <template #default="{ id }">
            <AppInput :id="id" v-model="appliedAt" type="date" />
          </template>
        </FormField>

        <FormField label="下次跟进" id="job-next-action">
          <template #default="{ id }">
            <AppInput :id="id" v-model="nextActionAt" type="date" />
          </template>
        </FormField>
      </div>

      <FormField label="跟进事项" id="job-next-note" hint="如：等一面结果、周三前发感谢信">
        <template #default="{ id, describedBy }">
          <AppInput
            :id="id"
            v-model="nextActionNote"
            placeholder="选填"
            :aria-describedby="describedBy"
          />
        </template>
      </FormField>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="薪资范围" id="job-salary">
          <template #default="{ id }">
            <AppInput :id="id" v-model="salaryRange" placeholder="如：30-45K·14薪" />
          </template>
        </FormField>

        <FormField label="岗位链接" id="job-url">
          <template #default="{ id }">
            <AppInput :id="id" v-model="jobUrl" placeholder="https://..." inputmode="url" />
          </template>
        </FormField>
      </div>

      <FormField label="备注" id="job-notes">
        <template #default="{ id }">
          <AppTextarea :id="id" v-model="notes" :rows="3" placeholder="面试官、笔试题、需要准备的内容…" />
        </template>
      </FormField>
    </form>

    <template #footer>
      <AppButton variant="ghost" :disabled="submitting" @click="emit('update:open', false)">
        取消
      </AppButton>
      <AppButton type="submit" form="job-form" :loading="submitting">
        {{ isEdit ? '保存修改' : '添加记录' }}
      </AppButton>
    </template>
  </AppModal>
</template>
