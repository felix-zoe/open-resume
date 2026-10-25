<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck
} from 'lucide-vue-next';
import { AppButton, AppInput, AppSelect, AppSwitch, FormField, type SelectOption } from '../ui';
import { AI_PROVIDERS, CUSTOM_PROVIDER_ID, findAiProvider } from '../../../shared/ai';
import {
  resolveApiKey,
  resolveBaseUrl,
  resolveModel,
  withApiKey,
  withBaseUrl,
  withModel,
  withProvider,
  type AiConfig
} from '../../utils/aiConfig';
import { requestAiModels, requestAiRewrite } from '../../utils/aiRewrite';

/**
 * 模型接入设置表单。
 *
 * 被「AI 改写」抽屉与账号设置页共用：两处需要填的是同一组字段，
 * 分开写两份一定会漂移（一处加了新厂商，另一处不认）。
 *
 * 表单是受控的：值来自 `config`，改动通过 `update:config` 交回父级落盘。
 * 这样「配置存在哪」只有父级知道，表单本身不碰 localStorage。
 */

const props = withDefaults(
  defineProps<{
    config: AiConfig;
    /** 嵌在抽屉里时更紧凑：省掉说明性文字 */
    compact?: boolean;
  }>(),
  { compact: false }
);

const emit = defineEmits<{ (e: 'update:config', value: AiConfig): void }>();

const showKey = ref(false);
const isTesting = ref(false);
const isFetchingModels = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);
/** 「拉取模型列表」拿回来的候选，与预设候选合并后进 datalist */
const fetchedModels = ref<string[]>([]);

const preset = computed(() => findAiProvider(props.config.providerId));
const isCustom = computed(() => props.config.providerId === CUSTOM_PROVIDER_ID);

const providerOptions = computed<SelectOption[]>(() =>
  AI_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name }))
);

const suggestions = computed(() => {
  const merged = new Set<string>([...(preset.value?.models ?? []), ...fetchedModels.value]);
  const current = resolveModel(props.config);
  if (current) merged.add(current);
  return Array.from(merged);
});

const model = computed({
  get: () => resolveModel(props.config),
  set: (value: string) => emit('update:config', withModel(props.config, value))
});

const baseUrl = computed({
  get: () => resolveBaseUrl(props.config),
  set: (value: string) => emit('update:config', withBaseUrl(props.config, value))
});

const apiKey = computed({
  get: () => resolveApiKey(props.config),
  set: (value: string) => {
    // 一改 Key 就把上次的测试结论作废：那个结论属于旧 Key
    testResult.value = null;
    emit('update:config', withApiKey(props.config, value));
  }
});

const rememberKey = computed({
  get: () => props.config.rememberKey,
  set: (value: boolean) => emit('update:config', { ...props.config, rememberKey: value })
});

function handleProviderChange(providerId: string) {
  testResult.value = null;
  fetchedModels.value = [];
  emit('update:config', withProvider(props.config, providerId));
}

async function handleFetchModels() {
  if (!resolveApiKey(props.config)) {
    testResult.value = { ok: false, message: '先填写 API Key 才能拉取模型列表' };
    return;
  }

  isFetchingModels.value = true;
  try {
    const result = await requestAiModels(props.config);
    if (!result.ok) {
      /*
       * 不提供 `/models` 的厂商会返回 404 —— 这并不代表 Key 有问题，
       * 因此只当提示，不当作错误：手填模型名一直可用。
       */
      testResult.value = {
        ok: false,
        message: `${result.message}。部分厂商不提供模型列表接口，可以直接手填模型名`
      };
      return;
    }
    fetchedModels.value = result.data?.models ?? [];
    testResult.value = fetchedModels.value.length
      ? { ok: true, message: `拉到 ${fetchedModels.value.length} 个模型，下拉里选一个` }
      : { ok: false, message: '该厂商没有返回模型列表，请手动填写模型名' };
  } finally {
    isFetchingModels.value = false;
  }
}

/**
 * 连接测试。
 *
 * 刻意用一次**真实的改写请求**而不是「只验证 Key 格式」：用户想知道的是
 * 「点了改写会不会成功」，只有走完整条链路才能回答这个问题。
 * 代价是消耗几十个 token，且用的是他自己的 Key。
 */
async function handleTest() {
  isTesting.value = true;
  testResult.value = null;
  try {
    const result = await requestAiRewrite(props.config, {
      text: '负责公司官网前端开发工作。',
      style: 'professional',
      target: 'custom'
    });
    testResult.value = result.ok
      ? { ok: true, message: '连接正常，改写链路可用' }
      : { ok: false, message: result.message };
  } finally {
    isTesting.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="!compact" class="text-xs text-slate-600 leading-relaxed">
      改写用的是<strong>你自己的 API Key</strong>，费用记在你的账号上。
      Key 只保存在这台浏览器里，请求经本站转发到你所选的厂商，
      <strong>我们不保存 Key，也不保存送去改写的内容</strong>。
    </p>

    <FormField label="模型厂商" id="ai-provider" required :hint="isCustom ? '自定义厂商需要自己填地址' : undefined">
      <template #default="{ id, describedBy }">
        <AppSelect
          :id="id"
          :model-value="config.providerId"
          :options="providerOptions"
          :aria-describedby="describedBy"
          @update:model-value="handleProviderChange"
        />
      </template>
    </FormField>

    <FormField
      label="接口地址"
      id="ai-base-url"
      :hint="isCustom ? 'OpenAI 兼容端点，须为 https，不要带 /chat/completions' : '预设厂商的地址由内置表决定，不能修改'"
    >
      <template #default="{ id, describedBy }">
        <AppInput v-if="isCustom" :id="id" v-model="baseUrl" placeholder="https://your-gateway.example.com/v1" :aria-describedby="describedBy" />
        <p
          v-else
          :id="id"
          class="h-9 flex items-center px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 font-mono truncate"
          :title="baseUrl"
        >
          {{ baseUrl || '—' }}
        </p>
      </template>
    </FormField>

    <FormField
      label="模型"
      id="ai-model"
      required
      hint="模型名各厂改动频繁，可直接用「拉取列表」从厂商那里取最新的"
    >
      <template #default="{ id, describedBy }">
        <div class="flex items-center gap-2">
          <AppInput
            :id="id"
            v-model="model"
            list="ai-model-suggestions"
            :placeholder="preset?.defaultModel || '如 qwen-plus'"
            :aria-describedby="describedBy"
          />
          <AppButton
            variant="secondary"
            size="sm"
            class="shrink-0"
            :loading="isFetchingModels"
            @click="handleFetchModels"
          >
            <template #icon>
              <RefreshCw class="w-3.5 h-3.5" aria-hidden="true" />
            </template>
            <span>拉取列表</span>
          </AppButton>
        </div>
        <datalist id="ai-model-suggestions">
          <option v-for="item in suggestions" :key="item" :value="item" />
        </datalist>
      </template>
    </FormField>

    <FormField label="API Key" id="ai-api-key" required>
      <template #default="{ id, describedBy }">
        <div class="relative">
          <AppInput
            :id="id"
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            has-trailing
            placeholder="粘贴厂商控制台里的 Key"
            :aria-describedby="describedBy"
          />
          <button
            type="button"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            :aria-label="showKey ? '隐藏 Key' : '显示 Key'"
            :aria-pressed="showKey"
            @click="showKey = !showKey"
          >
            <component :is="showKey ? EyeOff : Eye" class="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </template>
    </FormField>

    <AppSwitch
      v-model="rememberKey"
      label="在这台设备上记住 Key"
      description="关闭后关闭页面即清空，公共电脑上建议关闭"
    />

    <!-- 厂商说明与申请入口 -->
    <div v-if="preset?.note || preset?.keyUrl" class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 space-y-1.5">
      <p v-if="preset?.note" class="text-2xs text-slate-600 leading-relaxed flex items-start gap-1.5">
        <AlertTriangle class="w-3.5 h-3.5 text-warning-500 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{{ preset.note }}</span>
      </p>
      <a
        v-if="preset?.keyUrl"
        :href="preset.keyUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-2xs font-semibold text-primary-600 hover:text-primary-700"
      >
        <KeyRound class="w-3 h-3" aria-hidden="true" />
        <span>去 {{ preset.name }} 申请 API Key</span>
        <ExternalLink class="w-3 h-3" aria-hidden="true" />
      </a>
    </div>

    <!-- 连接测试 -->
    <div class="flex flex-wrap items-center gap-2">
      <AppButton variant="secondary" size="sm" :loading="isTesting" @click="handleTest">
        <template #icon>
          <Loader2 v-if="isTesting" class="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          <ShieldCheck v-else class="w-3.5 h-3.5" aria-hidden="true" />
        </template>
        <span>测试连接</span>
      </AppButton>

      <p
        v-if="testResult"
        class="text-2xs leading-relaxed flex items-start gap-1.5 min-w-0"
        :class="testResult.ok ? 'text-success-700' : 'text-danger-700'"
        role="status"
      >
        <component
          :is="testResult.ok ? CheckCircle2 : AlertTriangle"
          class="w-3.5 h-3.5 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <span class="break-words">{{ testResult.message }}</span>
      </p>
    </div>
  </div>
</template>