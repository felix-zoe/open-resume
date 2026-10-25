<script setup lang="ts">
import { computed, ref } from 'vue';
import { useResumeStore } from '../stores/resume';
import { analyzeResumeAgainstJd, AtsAnalysisResult } from '../utils/atsAnalyzer';
import {
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  FileText
} from 'lucide-vue-next';
import { AppBadge, AppButton, AppModal, AppTextarea, FormField } from './ui';

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

const jdText = ref('');
const result = ref<AtsAnalysisResult | null>(null);
const isAnalyzing = ref(false);

const sampleJd = `岗位职责：
1. 负责核心业务系统前端架构设计与研发，主导微前端底座平滑演进与性能调优；
2. 熟练运用 Vue3、TypeScript、Pinia、Vite，对前端工程化及 CI/CD 流程有深入实践；
3. 攻坚 Canvas/WebGL 可视化及复杂交互卡顿，保障首屏加载性能与流畅度；
4. 深度协同后端开发，具备 Docker 容器化部署与 Node.js 服务端开发经验优先；
5. 善于用量化数据（如性能提升%、卡顿率降低%）驱动业务价值落地。`;

const loadSampleJd = () => {
  jdText.value = sampleJd;
  handleAnalyze();
};

const handleAnalyze = () => {
  if (!jdText.value.trim()) return;
  isAnalyzing.value = true;
  setTimeout(() => {
    result.value = analyzeResumeAgainstJd(resumeStore.content, jdText.value);
    isAnalyzing.value = false;
  }, 300);
};

/**
 * 覆盖度只给「充分 / 部分 / 不足」三档，不折算成百分制分数。
 *
 * 分数会让人误以为存在客观的通过标准；三档描述只回答「还差多少关键词」，
 * 用户能自己决定要不要补。阈值按权重覆盖率（任职要求权重 1、职责 0.5）划分。
 */
const coverageLevel = computed(() => {
  if (!result.value) return { text: '', tone: 'neutral' as const };
  const ratio = result.value.keywordCoverage.ratio;
  if (ratio >= 0.8) return { text: '关键词覆盖充分', tone: 'success' as const };
  if (ratio >= 0.5) return { text: '覆盖部分，仍有缺口', tone: 'primary' as const };
  return { text: '关键词缺口较多', tone: 'warning' as const };
});
</script>

<template>
  <AppModal
    v-model:open="open"
    size="lg"
    title="岗位 JD 关键词对照"
    class="max-w-3xl"
  >
    <template #header>
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
          <Target class="w-4 h-4" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-slate-900">岗位 JD 关键词对照</h2>
          <p class="text-2xs text-slate-500">
            粘贴招聘要求，对照简历中的关键词覆盖、量化指标与动词使用
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <!-- JD 输入 -->
      <FormField
        label="目标职位招聘要求"
        id="ats-jd"
        hint="内容仅在浏览器本地计算，不会上传服务器"
      >
        <template #default="{ id, describedBy }">
          <AppTextarea
            :id="id"
            v-model="jdText"
            :rows="4"
            :aria-describedby="describedBy"
            placeholder="粘贴 BOSS 直聘 / 猎聘 / 拉勾 或企业官网的目标岗位职责与任职要求…"
          />
        </template>
      </FormField>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <AppButton variant="ghost" size="sm" @click="loadSampleJd">
          <template #icon>
            <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
          </template>
          <span>填入示例 JD</span>
        </AppButton>
        <AppButton
          size="sm"
          :loading="isAnalyzing"
          :disabled="!jdText.trim()"
          @click="handleAnalyze"
        >
          开始对照
        </AppButton>
      </div>

      <!-- 结果 -->
      <div v-if="result" class="space-y-4 pt-4 border-t border-slate-100">
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 shrink-0 flex flex-col items-center justify-center rounded-xl bg-white border border-slate-200">
              <span class="text-2xl font-bold font-mono text-slate-900">
                {{ Math.round(result.keywordCoverage.ratio * 100) }}%
              </span>
              <span class="text-2xs text-slate-500">关键词覆盖</span>
            </div>
            <div>
              <AppBadge :tone="coverageLevel.tone" size="md">{{ coverageLevel.text }}</AppBadge>
              <p class="text-xs text-slate-600 mt-1.5">
                命中 {{ result.keywordCoverage.matched.length }} 个关键词 · 量化描述占比
                {{ Math.round(result.metricsDensity.ratio * 100) }}%
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
            <div class="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
              <div class="text-2xs text-slate-500">已命中</div>
              <div class="text-sm font-bold text-success-600 font-mono mt-0.5">
                {{ result.keywordCoverage.matched.length }} 项
              </div>
            </div>
            <div class="p-2.5 bg-white rounded-lg border border-slate-200 text-center">
              <div class="text-2xs text-slate-500">待补充</div>
              <div class="text-sm font-bold text-danger-600 font-mono mt-0.5">
                {{ result.keywordCoverage.missing.length }} 项
              </div>
            </div>
          </div>
        </div>

        <!-- 关键词对照 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-success-50/60 border border-success-100">
            <div class="text-xs font-bold text-success-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 class="w-4 h-4" aria-hidden="true" />
              <span>简历中已有 ({{ result.keywordCoverage.matched.length }})</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <AppBadge v-for="kw in result.keywordCoverage.matched" :key="kw" tone="success">
                {{ kw }}
              </AppBadge>
              <span v-if="!result.keywordCoverage.matched.length" class="text-xs text-slate-500">
                暂未命中，可按右侧建议补充技能描述
              </span>
            </div>
          </div>

          <div class="p-3.5 rounded-xl bg-danger-50/60 border border-danger-100">
            <div class="text-xs font-bold text-danger-700 mb-2 flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5">
                <AlertTriangle class="w-4 h-4" aria-hidden="true" />
                <span>JD 提到但简历缺失 ({{ result.keywordCoverage.missing.length }})</span>
              </span>
              <span class="text-2xs text-slate-500 font-normal">按重要度排序</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <!--
                只展示，不提供「一键写入」：把 JD 里的词直接塞进技能栏，
                等于让简历替用户说谎，面试时反而暴露短板。是否真的会、要不要写，
                只能由用户自己判断。
              -->
              <AppBadge
                v-for="kw in result.keywordCoverage.missing"
                :key="kw"
                tone="danger"
              >
                {{ kw }}
              </AppBadge>
              <span v-if="!result.keywordCoverage.missing.length" class="text-xs text-success-700">
                该岗位的核心关键词已全部覆盖
              </span>
            </div>
          </div>
        </div>

        <!-- 量化与动词 -->
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div class="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
              <span class="flex items-center gap-1.5">
                <TrendingUp class="w-4 h-4 text-primary-600" aria-hidden="true" />
                <span>量化描述占比</span>
              </span>
              <span class="font-mono text-primary-700">
                {{ Math.round(result.metricsDensity.ratio * 100) }}%
              </span>
            </div>
            <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary-500 rounded-full transition-all duration-500"
                :style="{ width: `${result.metricsDensity.ratio * 100}%` }"
              />
            </div>
            <p class="text-2xs text-slate-500 mt-1.5">
              {{ result.metricsDensity.pointsWithMetrics }} / {{ result.metricsDensity.totalPoints }}
              条经历包含具体数据
            </p>
          </div>

          <div>
            <div class="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
              <span class="flex items-center gap-1.5">
                <BarChart3 class="w-4 h-4 text-primary-600" aria-hidden="true" />
                <span>动词使用</span>
              </span>
              <span class="text-2xs font-normal text-slate-500">
                强 {{ result.actionVerbAnalysis.strongCount }} · 弱 {{ result.actionVerbAnalysis.weakCount }}
              </span>
            </div>
            <AppBadge v-if="result.actionVerbAnalysis.weakCount > 0" tone="warning">
              可把「负责 / 协助」换成「主导 / 搭建 / 重构」
            </AppBadge>
            <AppBadge v-else tone="success">动词使用主动有力</AppBadge>
          </div>
        </div>

        <!-- 建议 -->
        <div class="p-3.5 rounded-xl bg-primary-50/50 border border-primary-100">
          <h3 class="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            <span>针对该岗位的建议</span>
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="(suggestion, index) in result.suggestions"
              :key="index"
              class="text-xs text-slate-600 flex items-start gap-2 leading-relaxed"
            >
              <ArrowRight class="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{{ suggestion }}</span>
            </li>
          </ul>
        </div>
      </div>

      <p class="text-2xs text-slate-500 flex items-start gap-1.5 leading-relaxed">
        <FileText class="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          基于关键词匹配，仅供参考；不构成任何招聘筛选结果的预测。
          覆盖度按词频权重计算（任职要求权重 1.0、岗位职责 0.5），同义词已归一。
        </span>
      </p>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="emit('close')">完成并继续编辑</AppButton>
    </template>
  </AppModal>
</template>
