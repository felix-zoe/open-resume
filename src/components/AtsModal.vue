<script setup lang="ts">
import { ref, computed } from 'vue';
import { useResumeStore } from '../stores/resume';
import { analyzeResumeAgainstJd, AtsAnalysisResult } from '../utils/atsAnalyzer';
import {
  X,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  BarChart3,
  FileText
} from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const resumeStore = useResumeStore();

// 招聘 JD 文本输入
const jdText = ref('');
const result = ref<AtsAnalysisResult | null>(null);
const isAnalyzing = ref(false);

// 示例 JD 预设
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

// 一键将缺失技能补充到当前技能列表
const addMissingSkill = (skill: string) => {
  if (!resumeStore.content.modules.skills.items.includes(skill)) {
    resumeStore.content.modules.skills.items.push(skill);
    resumeStore.content.modules.skills.visible = true;
    // 重新分析实时刷新
    result.value = analyzeResumeAgainstJd(resumeStore.content, jdText.value);
  }
};

// 得分等级
const scoreLevel = computed(() => {
  if (!result.value) return { text: '', color: '' };
  if (result.value.score >= 80) return { text: '极高契合度 (通过率极高)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  if (result.value.score >= 60) return { text: '良好契合 (具备核心基础)', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  return { text: '待优化 (关键词缺失较多)', color: 'text-amber-600 bg-amber-50 border-amber-200' };
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto no-print">
    <!-- 背景遮罩 -->
    <div @click="emit('close')" class="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity"></div>

    <div class="min-h-full flex items-center justify-center p-4 sm:p-6">
      <div class="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <!-- 弹窗顶栏 -->
        <div class="px-6 py-4.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Target class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>目标岗位 (JD) 匹配度诊断 & ATS 评分</span>
                <span class="text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-1.5 py-0.2 rounded font-medium shadow-2xs">免费尊享</span>
              </h2>
              <p class="text-[11px] text-slate-500">粘贴招聘要求，自动诊断关键词覆盖率、量化指标密度与动词力量</p>
            </div>
          </div>
          <button @click="emit('close')" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- 弹窗主体内容 -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- 1. JD 输入框 -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-slate-800 flex items-center gap-1">
                <FileText class="w-3.5 h-3.5 text-blue-600" />
                <span>目标职位招聘要求 (Job Description)</span>
              </label>
              <button
                type="button"
                @click="loadSampleJd"
                class="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
              >
                <Sparkles class="w-3 h-3" />
                <span>填入示范 JD</span>
              </button>
            </div>
            <textarea
              v-model="jdText"
              rows="4"
              placeholder="在此粘贴 BOSS直聘 / 猎聘 / 拉勾 或企业官网的目标岗位职责与任职要求..."
              class="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-sans leading-relaxed transition"
            ></textarea>
            <div class="mt-2 flex justify-end">
              <button
                @click="handleAnalyze"
                :disabled="!jdText.trim() || isAnalyzing"
                class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>{{ isAnalyzing ? '正在深度诊断...' : '开始匹配度诊断' }}</span>
              </button>
            </div>
          </div>

          <!-- 2. 诊断结果面板 -->
          <div v-if="result" class="space-y-5 pt-2 border-t border-slate-100">
            <!-- 核心得分卡片 -->
            <div class="p-5 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
              <div class="flex items-center gap-5">
                <div class="relative w-20 h-20 shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <span class="text-3xl font-black font-mono">{{ result.score }}</span>
                  <span class="text-[10px] absolute bottom-1.5 opacity-80 font-sans">综合评分</span>
                </div>
                <div>
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mb-1.5" :class="scoreLevel.color">
                    <span>{{ scoreLevel.text }}</span>
                  </div>
                  <p class="text-xs text-slate-500">
                    已命中 {{ result.matchedKeywords.length }} 个核心技能词 · 量化指标占比 {{ Math.round(result.metricsDensity.ratio * 100) }}%
                  </p>
                </div>
              </div>

              <!-- 核心维度小统计 -->
              <div class="grid grid-cols-2 gap-3 w-full sm:w-auto">
                <div class="p-3 bg-white rounded-xl border border-slate-200/60 text-center">
                  <div class="text-xs text-slate-400">已匹配关键词</div>
                  <div class="text-base font-extrabold text-emerald-600 font-mono mt-0.5">{{ result.matchedKeywords.length }} 项</div>
                </div>
                <div class="p-3 bg-white rounded-xl border border-slate-200/60 text-center">
                  <div class="text-xs text-slate-400">待补充关键词</div>
                  <div class="text-base font-extrabold text-rose-500 font-mono mt-0.5">{{ result.missingKeywords.length }} 项</div>
                </div>
              </div>
            </div>

            <!-- 关键词覆盖对比看板 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- 已命中关键词 -->
              <div class="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80">
                <div class="text-xs font-bold text-emerald-900 mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 class="w-4 h-4 text-emerald-600" />
                  <span>已命中岗位关键词 ({{ result.matchedKeywords.length }})</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="kw in result.matchedKeywords"
                    :key="kw"
                    class="text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs"
                  >
                    ✓ {{ kw }}
                  </span>
                  <span v-if="result.matchedKeywords.length === 0" class="text-xs text-emerald-600/70">
                    暂未命中，请根据右侧建议补充技能描述
                  </span>
                </div>
              </div>

              <!-- 待补充关键词 (带一键添加) -->
              <div class="p-4 rounded-2xl bg-rose-50/50 border border-rose-100/80">
                <div class="text-xs font-bold text-rose-900 mb-2.5 flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <AlertTriangle class="w-4 h-4 text-rose-500" />
                    <span>缺失关键词 ({{ result.missingKeywords.length }})</span>
                  </span>
                  <span class="text-[10px] text-rose-500 font-normal">点击可一键补到技能栏</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="kw in result.missingKeywords"
                    :key="kw"
                    @click="addMissingSkill(kw)"
                    title="点击一键添加到当前简历专业技能列表"
                    class="text-[11px] font-medium text-rose-700 bg-white hover:bg-rose-600 hover:text-white border border-rose-200 px-2 py-0.5 rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer group"
                  >
                    <span>{{ kw }}</span>
                    <Plus class="w-3 h-3 text-rose-400 group-hover:text-white" />
                  </button>
                  <span v-if="result.missingKeywords.length === 0" class="text-xs text-rose-600/70">
                    🎉 完美！岗位所有核心关键词已全部覆盖！
                  </span>
                </div>
              </div>
            </div>

            <!-- 量化指标与动词分析 -->
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span class="flex items-center gap-1.5">
                    <TrendingUp class="w-4 h-4 text-blue-600" />
                    <span>量化指标密度 (数字结果支撑)</span>
                  </span>
                  <span class="font-mono text-blue-600">{{ Math.round(result.metricsDensity.ratio * 100) }}%</span>
                </div>
                <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-blue-600 transition-all duration-500 rounded-full"
                    :style="{ width: `${result.metricsDensity.ratio * 100}%` }"
                  ></div>
                </div>
                <p class="text-[11px] text-slate-400 mt-1.5">
                  {{ result.metricsDensity.pointsWithMetrics }} / {{ result.metricsDensity.totalPoints }} 条经历描述包含具体数据指标
                </p>
              </div>

              <div>
                <div class="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                  <span class="flex items-center gap-1.5">
                    <BarChart3 class="w-4 h-4 text-indigo-600" />
                    <span>动词影响力强度</span>
                  </span>
                  <span class="text-[11px] font-normal text-slate-500">强动词: {{ result.actionVerbAnalysis.strongCount }} · 弱动词: {{ result.actionVerbAnalysis.weakCount }}</span>
                </div>
                <div class="flex gap-1 items-center text-[11px] text-slate-500 mt-2">
                  <span v-if="result.actionVerbAnalysis.weakCount > 0" class="text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded">
                    建议替换“负责/协助”为“主导/搭建/重构”
                  </span>
                  <span v-else class="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded">
                    动词积极有力，展现了良好的主动性
                  </span>
                </div>
              </div>
            </div>

            <!-- 诊断与优化建议清单 -->
            <div class="p-4 rounded-2xl bg-blue-50/40 border border-blue-100">
              <h4 class="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-blue-600" />
                <span>针对该岗位的专属改进建议</span>
              </h4>
              <ul class="space-y-1.5">
                <li
                  v-for="(sug, idx) in result.suggestions"
                  :key="idx"
                  class="text-xs text-slate-600 flex items-start gap-2 leading-relaxed"
                >
                  <ArrowRight class="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>{{ sug }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 弹窗底部 -->
        <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-400">诊断在本地完成，保障简历与求职目标隐私安全</span>
          <button
            @click="emit('close')"
            class="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
          >
            完成并继续编辑
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
