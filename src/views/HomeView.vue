<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AppFooter from '../components/AppFooter.vue';
import TemplatePreview from '../components/home/TemplatePreview.vue';
import { AppBadge, AppButton, AppCard } from '../components/ui';
import { TEMPLATES, findTemplate } from '../constants/templates';
import { RESUME_EXAMPLES } from '../constants/examples';
import {
  applyPageMeta,
  faqJsonLd,
  removeJsonLd,
  setJsonLd,
  softwareApplicationJsonLd
} from '../utils/seo';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Layers,
  LayoutTemplate,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target
} from 'lucide-vue-next';

const router = useRouter();

const startWithTemplate = (templateId: string) => {
  router.push({ path: '/editor/new', query: { template: templateId } });
};

// 三步流程
const STEPS = [
  {
    title: '选择模板',
    desc: '四套针对不同岗位设计的排版，随时可换，内容不受影响。'
  },
  {
    title: '填写内容',
    desc: '左侧结构化录入，右侧按 A4 实时预览，所见即所得。'
  },
  {
    title: '导出或分享',
    desc: '用浏览器打印导出 PDF，或生成在线只读链接直接发给 HR。'
  }
];

// 能力清单（只写实际具备的能力）
const FEATURES = [
  {
    icon: Sparkles,
    title: '一键收敛到单页',
    desc: '自动收紧行高、段落与模块间距，把内容压进一页 A4，不改变字号与文字。'
  },
  {
    icon: Download,
    title: '浏览器原生打印导出',
    desc: '走 @media print 输出矢量 PDF，文字可复制、链接可点击，无平台水印。'
  },
  {
    icon: Layers,
    title: '内容与排版分离',
    desc: '经历数据独立于模板，切换经典、极客或双栏模板都不会丢失已填内容。'
  },
  {
    icon: Sliders,
    title: '毫米级排版微调',
    desc: '字号、行高、段落间距、模块间距与页边距都可调，精确控制一页纸的疏密。'
  },
  {
    icon: Target,
    title: 'JD 关键词对照',
    desc: '粘贴招聘要求，本地比对关键词覆盖、量化描述与动词使用，给出补充建议。'
  },
  {
    icon: ShieldCheck,
    title: '可离线、可云端',
    desc: '不登录也能在本地完成制作；登录后可保存多份简历并生成只读分享链接。'
  }
];

const previewTemplateId = (id: string) => id as 'classic' | 'geek' | 'modern' | 'ats';

// FAQ
const openFaqIndex = ref<number | null>(0);
const FAQS = [
  {
    q: '导出的 PDF 文字能被招聘系统读取吗？',
    a: '可以。导出走浏览器原生打印，生成的是带真实文本层的矢量 PDF，文字可复制、可检索，链接也保持可点击。'
  },
  {
    q: '经历太多导致超出一页怎么办？',
    a: '在编辑器顶部点「一键单页」，系统会按当前内容高度收紧行高与各类间距。若内容远超一页，建议精简描述或分成两页呈现。'
  },
  {
    q: '不登录可以使用吗？',
    a: '可以。未登录时内容保存在当前浏览器的本地草稿中，刷新或下次打开仍在。登录后才会同步到云端并支持多份简历管理。'
  },
  {
    q: '能把简历链接直接发给 HR 吗？',
    a: '登录并保存到云端后，在看板里开启公开分享即可复制只读链接。对方无需登录就能查看，也可以自行导出 PDF。'
  }
];

const toggleFaq = (index: number) => {
  openFaqIndex.value = openFaqIndex.value === index ? null : index;
};

/**
 * 首页的结构化数据：站点能力 + FAQ。
 * FAQ 用页面上真实展示的同一份数组，避免「结构化数据写了、页面没有」被判定为作弊。
 */
onMounted(() => {
  // 标题必须与 scripts/prerender.mjs 写进 dist/index.html 的一致，
  // 否则客户端接管后会看到标题跳变
  applyPageMeta({
    title: 'OpenResume · 在线简历制作与原生 PDF 导出',
    description:
      '开源免费的在线简历制作平台：真实 A4 排版、四套专业模板、一键收敛单页、浏览器原生打印导出 PDF，无需注册即可开始。',
    path: '/'
  });
  setJsonLd('software', softwareApplicationJsonLd());
  setJsonLd('faq', faqJsonLd(FAQS));
});

onBeforeUnmount(() => {
  removeJsonLd('software');
  removeJsonLd('faq');
});

/** 模板卡片：适合行业直接取元数据里的 industry，避免首页再维护一份文案 */
const templateCards = computed(() =>
  TEMPLATES.map((template) => ({
    ...template,
    bestFor: template.industry.join('、')
  }))
);
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
    <Navbar />

    <main id="main-content" tabindex="-1" class="flex-1">
      <!-- Hero -->
      <!--
        首屏不再放 blur-3xl 装饰球：大半径模糊层在低端机上会触发整屏重绘，
        且对「这份简历能直接投」这件事没有任何信息量。留白交给版式本身。
      -->
      <section class="pt-14 pb-16 lg:pt-20 lg:pb-20">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            <div class="text-center lg:text-left">
              <AppBadge tone="primary" size="md">
                <Sparkles class="w-3 h-3" aria-hidden="true" />
                开源 · 无水印 · 免注册可用
              </AppBadge>

              <h1 class="mt-4 text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-[1.2]">
                写一份
                <span class="text-primary-600">排版规整</span>
                的简历，<br class="hidden sm:inline" />
                导出即可直接投递
              </h1>

              <p class="mt-5 text-sm sm:text-base text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                左侧结构化填写，右侧按标准 A4 实时预览。用浏览器原生打印导出矢量 PDF，文字可复制、无平台水印。
              </p>

              <div class="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <AppButton size="lg" @click="router.push('/editor/new')">
                  <template #icon>
                    <Sparkles class="w-4 h-4" aria-hidden="true" />
                  </template>
                  <span>开始制作</span>
                </AppButton>
                <a
                  href="#templates"
                  class="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
                >
                  <LayoutTemplate class="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>先看模板</span>
                </a>
              </div>

              <ul class="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs text-slate-500">
                <li v-for="item in ['无需注册', '无水印', '可离线编辑']" :key="item" class="flex items-center gap-1.5">
                  <Check class="w-3.5 h-3.5 text-success-600" aria-hidden="true" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <!-- 真实模板预览 -->
            <div class="relative mx-auto w-full max-w-sm lg:max-w-none">
              <div class="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-300/30 rotate-1 hover:rotate-0 transition-transform duration-300">
                <TemplatePreview template-id="classic" class="rounded-xl" />
              </div>
              <div class="absolute -bottom-5 -left-4 hidden sm:block rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
                <div class="text-2xs text-slate-500">A4 标准幅面</div>
                <div class="text-xs font-bold text-slate-900 font-mono">210 × 297 mm</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 三步流程 -->
      <section class="py-14 bg-white border-y border-slate-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-10">
            <h2 class="home-section-title text-2xl sm:text-3xl font-black text-slate-900">三步完成一份简历</h2>
            <p class="text-sm text-slate-500 mt-2">不需要排版软件，也不需要登录</p>
          </div>

          <ol class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <li v-for="(step, index) in STEPS" :key="step.title">
              <AppCard class="h-full">
                <div class="flex items-center gap-2.5">
                  <span class="w-7 h-7 rounded-full bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center font-mono">
                    {{ index + 1 }}
                  </span>
                  <h3 class="text-sm font-bold text-slate-900">{{ step.title }}</h3>
                </div>
                <p class="text-xs text-slate-500 mt-2.5 leading-relaxed">{{ step.desc }}</p>
              </AppCard>
            </li>
          </ol>
        </div>
      </section>

      <!-- 模板 -->
      <section id="templates" class="py-16 bg-slate-50 scroll-mt-16">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-10">
            <h2 class="home-section-title text-2xl sm:text-3xl font-black text-slate-900">四套模板，覆盖常见岗位</h2>
            <p class="text-sm text-slate-500 mt-2">换模板不会丢失内容，编辑过程中也能随时切换</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <article
              v-for="template in templateCards"
              :key="template.id"
              class="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition"
            >
              <TemplatePreview :template-id="previewTemplateId(template.id)" class="border-b border-slate-200" />

              <div class="p-4 flex flex-col flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-slate-900">{{ template.shortName }}</h3>
                  <AppBadge tone="primary">{{ template.tag }}</AppBadge>
                </div>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">{{ template.description }}</p>
                <p class="text-2xs text-slate-500 mt-3">
                  <span class="font-semibold text-slate-600">适合：</span>{{ template.bestFor }}
                </p>

                <AppButton
                  variant="secondary"
                  size="sm"
                  block
                  class="mt-4"
                  :aria-label="`用这个模板开始（${template.shortName}）`"
                  @click="startWithTemplate(template.id)"
                >
                  <span>用这个模板开始</span>
                  <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
                </AppButton>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- 能力 -->
      <section class="py-16 bg-white border-y border-slate-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-10">
            <h2 class="home-section-title text-2xl sm:text-3xl font-black text-slate-900">简历之外，真正影响投递的部分</h2>
            <p class="text-sm text-slate-500 mt-2">从排版到关键词对照，覆盖投递前的关键检查</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AppCard v-for="feature in FEATURES" :key="feature.title" class="h-full">
              <div class="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                <component :is="feature.icon" class="w-[18px] h-[18px]" aria-hidden="true" />
              </div>
              <h3 class="text-sm font-bold text-slate-900 mt-3">{{ feature.title }}</h3>
              <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">{{ feature.desc }}</p>
            </AppCard>
          </div>
        </div>
      </section>

      <!-- 岗位示例 -->
      <section class="py-16 bg-slate-50">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-xl mx-auto mb-10">
            <h2 class="home-section-title text-2xl sm:text-3xl font-black text-slate-900">按岗位选择起点</h2>
            <p class="text-sm text-slate-500 mt-2">不同岗位关注的信息不同，每个示例都附带可套用的模板与写法建议</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AppCard v-for="example in RESUME_EXAMPLES" :key="example.slug" class="h-full flex flex-col">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-slate-900">{{ example.name }}</h3>
                <AppBadge tone="neutral">{{ findTemplate(example.templateId).shortName }}</AppBadge>
              </div>
              <ul class="mt-3 space-y-1.5 flex-1">
                <li
                  v-for="point in example.highlights"
                  :key="point"
                  class="text-xs text-slate-600 flex items-start gap-2 leading-relaxed"
                >
                  <Check class="w-3.5 h-3.5 text-success-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{{ point }}</span>
                </li>
              </ul>
              <AppButton
                variant="subtle"
                size="sm"
                block
                class="mt-4"
                :aria-label="`查看示例：${example.name}`"
                @click="router.push(`/examples/${example.slug}`)"
              >
                <span>查看示例</span>
                <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
              </AppButton>
            </AppCard>
          </div>

          <p class="text-center mt-6">
            <RouterLink to="/examples" class="text-xs font-semibold text-primary-700 hover:text-primary-800">
              查看全部简历示例与写法建议 →
            </RouterLink>
          </p>
        </div>
      </section>

      <!-- FAQ -->
      <section class="py-16 bg-white border-t border-slate-200">
        <div class="max-w-3xl mx-auto px-4 sm:px-6">
          <div class="text-center mb-8">
            <h2 class="home-section-title text-2xl sm:text-3xl font-black text-slate-900">常见问题</h2>
          </div>

          <div class="space-y-2.5">
            <div
              v-for="(faq, index) in FAQS"
              :key="faq.q"
              class="border border-slate-200 rounded-xl bg-white overflow-hidden"
            >
              <h3>
                <button
                  type="button"
                  class="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 text-sm font-semibold text-slate-900 hover:text-primary-700 transition"
                  :aria-expanded="openFaqIndex === index"
                  @click="toggleFaq(index)"
                >
                  <span>{{ faq.q }}</span>
                  <ChevronDown
                    class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200"
                    :class="{ 'rotate-180': openFaqIndex === index }"
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div
                v-show="openFaqIndex === index"
                class="px-4 pb-4 text-xs text-slate-600 leading-relaxed"
              >
                {{ faq.a }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <AppFooter />
  </div>
</template>
