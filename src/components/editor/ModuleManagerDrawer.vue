<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { GripVertical, Eye, EyeOff, ChevronUp, ChevronDown, Pencil, Check, X } from 'lucide-vue-next';
import { useResumeStore } from '../../stores/resume';
import { ResumeModules } from '../../types/resume';
import { AppDrawer, AppButton, AppInput } from '../ui';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const resumeStore = useResumeStore();

const open = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
});

/** 本地草稿副本：拖动过程中不直接改 store，松手才提交，避免每帧触发自动保存 */
const draftOrder = ref<Array<keyof ResumeModules>>([]);

const MODULE_LABELS: Record<string, string> = {
  work: '工作经历',
  projects: '项目经历',
  skills: '专业技能',
  education: '教育背景',
  custom: '自定义模块'
};

function moduleTitle(key: keyof ResumeModules): string {
  return resumeStore.content.modules[key]?.title || MODULE_LABELS[key as string] || String(key);
}

function toggleVisible(key: keyof ResumeModules) {
  const mod = resumeStore.content.modules[key];
  if (mod) mod.visible = !mod.visible;
}

// ---------------- 拖拽排序（原生 HTML5 DnD，不引第三方库） ----------------
const draggingIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  draggingIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox 必须 setData 才会真正开始拖动
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  dragOverIndex.value = index;
}

function onDrop(index: number) {
  const from = draggingIndex.value;
  if (from === null || from === index) {
    resetDrag();
    return;
  }
  const next = [...draftOrder.value];
  const [moved] = next.splice(from, 1);
  next.splice(index, 0, moved);
  draftOrder.value = next;
  resetDrag();
}

function resetDrag() {
  draggingIndex.value = null;
  dragOverIndex.value = null;
}

/** 键盘与触屏兜底：拖拽在移动端体验不稳定，始终提供上下移动按钮 */
function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= draftOrder.value.length) return;
  const next = [...draftOrder.value];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  draftOrder.value = next;
}

// ---------------- 模块标题编辑 ----------------
const editingKey = ref<keyof ResumeModules | null>(null);
const editingValue = ref('');

function startEdit(key: keyof ResumeModules) {
  editingKey.value = key;
  editingValue.value = moduleTitle(key);
}

function commitEdit(key: keyof ResumeModules) {
  const next = editingValue.value.trim().slice(0, 20);
  if (next) resumeStore.content.modules[key].title = next;
  editingKey.value = null;
}

function cancelEdit() {
  editingKey.value = null;
}

/**
 * immediate：抽屉可能以 open=true 直接挂载（例如从外部状态恢复），
 * 不初始化会让列表空白。
 *
 * 必须放在 `editingKey` 声明**之后**：immediate 回调在 setup 期间同步执行，
 * 写在前面会命中 `const` 的暂时性死区，整个编辑器挂载报
 * `ReferenceError: Cannot access 'editingKey' before initialization`。
 */
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) draftOrder.value = [...resumeStore.content.modulesOrder];
    else editingKey.value = null;
  },
  { immediate: true }
);

// ---------------- 提交 ----------------
const dirty = computed(
  () => draftOrder.value.join(',') !== resumeStore.content.modulesOrder.join(',')
);

function apply() {
  resumeStore.content.modulesOrder = [...draftOrder.value];
  open.value = false;
}

function reset() {
  draftOrder.value = [...resumeStore.content.modulesOrder];
}
</script>

<template>
  <AppDrawer v-model:open="open" title="模块管理" width-class="w-[20rem]">
    <p class="text-2xs text-slate-500 leading-relaxed mb-3">
      拖动调整顺序，或使用上下按钮。顺序与显隐会立即反映到预览；关闭抽屉前不会保存顺序改动。
    </p>

    <ul class="space-y-2">
      <li
        v-for="(key, index) in draftOrder"
        :key="key"
        draggable="true"
        class="rounded-xl border bg-white p-2.5 transition"
        :class="[
          draggingIndex === index ? 'opacity-50 border-primary-300' : 'border-slate-200',
          dragOverIndex === index && draggingIndex !== index ? 'ring-2 ring-primary-200' : ''
        ]"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop(index)"
        @dragend="resetDrag"
      >
        <div class="flex items-center gap-2">
          <GripVertical class="w-4 h-4 text-slate-300 shrink-0 cursor-grab" aria-hidden="true" />

          <!-- 标题：可内联编辑 -->
          <div class="flex-1 min-w-0">
            <div v-if="editingKey === key" class="flex items-center gap-1">
              <AppInput
                v-model="editingValue"
                size="sm"
                maxlength="20"
                :aria-label="`${moduleTitle(key)} 的模块标题`"
                @keyup.enter="commitEdit(key)"
                @keyup.esc="cancelEdit"
              />
              <button
                type="button"
                class="p-1 rounded text-success-600 hover:bg-success-50"
                aria-label="确认标题"
                @click="commitEdit(key)"
              >
                <Check class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="p-1 rounded text-slate-400 hover:bg-slate-100"
                aria-label="取消编辑"
                @click="cancelEdit"
              >
                <X class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <div v-else class="flex items-center gap-1 min-w-0">
              <span
                class="text-xs font-semibold truncate"
                :class="resumeStore.content.modules[key].visible ? 'text-slate-800' : 'text-slate-400 line-through'"
              >
                {{ moduleTitle(key) }}
              </span>
              <button
                type="button"
                class="p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                :aria-label="`编辑「${moduleTitle(key)}」的标题`"
                @click="startEdit(key)"
              >
                <Pencil class="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          </div>

          <!-- 显隐 -->
          <button
            type="button"
            class="p-1.5 rounded-lg transition shrink-0"
            :class="resumeStore.content.modules[key].visible
              ? 'text-slate-500 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-slate-100'"
            :aria-label="resumeStore.content.modules[key].visible ? `隐藏「${moduleTitle(key)}」` : `显示「${moduleTitle(key)}」`"
            :aria-pressed="resumeStore.content.modules[key].visible"
            @click="toggleVisible(key)"
          >
            <component
              :is="resumeStore.content.modules[key].visible ? Eye : EyeOff"
              class="w-3.5 h-3.5"
              aria-hidden="true"
            />
          </button>

          <!-- 上下移动（触屏/键盘可用） -->
          <div class="flex flex-col shrink-0">
            <button
              type="button"
              class="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25"
              :disabled="index === 0"
              :aria-label="`「${moduleTitle(key)}」上移`"
              @click="move(index, -1)"
            >
              <ChevronUp class="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-25"
              :disabled="index === draftOrder.length - 1"
              :aria-label="`「${moduleTitle(key)}」下移`"
              @click="move(index, 1)"
            >
              <ChevronDown class="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p class="text-2xs text-slate-500 mt-3 leading-relaxed">
      标题与显隐即时生效；顺序需点击下方「应用顺序」保存。
    </p>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <AppButton v-if="dirty" variant="ghost" size="sm" @click="reset">还原顺序</AppButton>
        <AppButton size="sm" :disabled="!dirty" @click="apply">
          {{ dirty ? '应用顺序' : '已是最新顺序' }}
        </AppButton>
      </div>
    </template>
  </AppDrawer>
</template>
