<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Navbar from '../components/Navbar.vue';
import AppFooter from '../components/AppFooter.vue';
import TemplatePreview from '../components/home/TemplatePreview.vue';
import { AppBadge, AppButton, AppCard } from '../components/ui';
import { RESUME_EXAMPLES, buildExampleContent, findExample } from '../constants/examples';
import { findTemplate } from '../constants/templates';
import { applyPageMeta, breadcrumbJsonLd, removeJsonLd, setJsonLd } from '../utils/seo';
import { ArrowRight, Check, Lightbulb, Sparkles } from 'lucide-vue-next';

/**
 * 示例库。
 *
 * 一个路由两副面孔：
 * · `/examples` —— 列表页，给搜索引擎一个可索引的入口；
 * · `/examples/:slug` —— 详情页，展示真实模板渲染的简历 + 写法建议。
 *
 * 做成同一个组件是因为两者的头部、页脚、样式完全一致，
 * 拆成两个文件只会让「加一个岗位要改两处」。
 */
const route = useRoute();
const router = useRouter();

const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : ''));
const example = computed(() => (slug.value ? findExample(slug.value) : undefined));
const isDetail = computed(() => Boolean(slug.value));

const template = computed(() => (example.value ? findTemplate(example.value.templateId) : null));
/** 示例页展示的简历内容：默认范文改求职意向，中英各自取对应语言 */
const previewContent = computed(() => (example.value ? buildExampleContent(example.value) : null));
const others = computed(() => RESUME_EXAMPLES.filter((item) => item.slug !== slug.value));

function startFromExample() {
  if (!example.value) return;
  router.push({
    path: '/editor/new',
    query: {
      template: example.value.templateId,
      ...(example.value.locale === 'en' ? { locale: 'en' } : {})
    }
  });
}

/**
 * 元数据与面包屑都挂在同一个 watch 上：列表 ↔ 详情是同一个组件的路由参数变化，
 * 不会重新挂载，只有 watch 会重跑。
 */
watch(
  () => slug.value,
  (next) => {
    if (next && !example.value) {
      // 未知 slug 交给 404，而不是静默回落成列表（否则搜索引擎会索引到重复内容）
      router.replace({ name: 'NotFound', params: { pathMatch: ['examples', next] } });
      return;
    }

    const crumbs = [{ name: '首页', path: '/' }, { name: '简历示例', path: '/examples' }];
    if (example.value) {
      crumbs.push({ name: example.value.name, path: `/examples/${example.value.slug}` });
      applyPageMeta({
        title: example.value.seoTitle,
        description: example.value.description,
        path: `/examples/${example.value.slug}`
      });
    } else {
      applyPageMeta({
        title: '简历示例与写法建议',
        description:
          '按岗位整理的简历示例：前端、后端、产品、运营、应届生与外企英文简历，每份都带可套用的模板与写法建议。',
        path: '/examples'
      });
    }
    setJsonLd('breadcrumb', breadcrumbJsonLd(crumbs));
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  removeJsonLd('breadcrumb');
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
    <Navbar />

    <main id="main-content" tabindex="-1" class="flex-1">
      <!-- 列表 -->
      <template v-if="!isDetail">
        <section class="py-14">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="面包屑" class="text-2xs text-slate-500 mb-4">
              <RouterLink to="/" class="hover:text-primary-600">首页</RouterLink>
              <span class="mx-1.5" aria-hidden="true">/</span>
              <span class="text-slate-700">简历示例</span>
            </nav>

            <h1 class="text-2xl sm:text-3xl font-black text-slate-950">按岗位挑选起点</h1>
            <p class="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              每个示例都标注了该岗位最该强调的三点，以及常见的写法问题。选一个最接近的，套用后改内容即可。
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
              <AppCard v-for="item in RESUME_EXAMPLES" :key="item.slug" class="h-full flex flex-col">
                <div class="flex items-center justify-between gap-2">
                  <h2 class="text-sm font-bold text-slate-900">
                    <RouterLink :to="`/examples/${item.slug}`" class="hover:text-primary-700">
                      {{ item.name }}
                    </RouterLink>
                  </h2>
                  <AppBadge tone="neutral">{{ findTemplate(item.templateId).shortName }}</AppBadge>
                </div>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed flex-1">{{ item.description }}</p>
                <AppButton
                  variant="subtle"
                  size="sm"
                  block
                  class="mt-4"
                  :aria-label="`查看示例：${item.name}`"
                  @click="router.push(`/examples/${item.slug}`)"
                >
                  <span>查看示例</span>
                  <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
                </AppButton>
              </AppCard>
            </div>
          </div>
        </section>
      </template>

      <!-- 详情 -->
      <template v-else-if="example">
        <section class="py-10">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="面包屑" class="text-2xs text-slate-500 mb-4">
              <RouterLink to="/" class="hover:text-primary-600">首页</RouterLink>
              <span class="mx-1.5" aria-hidden="true">/</span>
              <RouterLink to="/examples" class="hover:text-primary-600">简历示例</RouterLink>
              <span class="mx-1.5" aria-hidden="true">/</span>
              <span class="text-slate-700">{{ example.name }}</span>
            </nav>

            <div class="grid lg:grid-cols-2 gap-8 lg:gap-10 items-start">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <AppBadge tone="primary">{{ template?.shortName }}</AppBadge>
                  <AppBadge v-if="example.locale === 'en'" tone="neutral">English</AppBadge>
                </div>

                <h1 class="mt-3 text-2xl sm:text-3xl font-black text-slate-950">{{ example.seoTitle }}</h1>
                <p class="mt-3 text-sm text-slate-600 leading-relaxed">{{ example.description }}</p>

                <h2 class="mt-6 text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Check class="w-4 h-4 text-success-600" aria-hidden="true" />
                  这份示例强调什么
                </h2>
                <ul class="mt-2 space-y-1.5">
                  <li
                    v-for="point in example.highlights"
                    :key="point"
                    class="text-xs text-slate-600 flex items-start gap-2 leading-relaxed"
                  >
                    <span class="w-1 h-1 rounded-full bg-primary-500 shrink-0 mt-1.5" aria-hidden="true" />
                    <span>{{ point }}</span>
                  </li>
                </ul>

                <h2 class="mt-6 text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Lightbulb class="w-4 h-4 text-warning-600" aria-hidden="true" />
                  写法建议
                </h2>
                <ol class="mt-2 space-y-2">
                  <li
                    v-for="(tip, index) in example.tips"
                    :key="tip"
                    class="text-xs text-slate-600 leading-relaxed flex gap-2"
                  >
                    <span class="font-mono text-slate-500 shrink-0">{{ index + 1 }}.</span>
                    <span>{{ tip }}</span>
                  </li>
                </ol>

                <div class="mt-7 flex flex-col sm:flex-row gap-2.5">
                  <AppButton size="lg" @click="startFromExample">
                    <template #icon>
                      <Sparkles class="w-4 h-4" aria-hidden="true" />
                    </template>
                    <span>用这个模板开始</span>
                  </AppButton>
                  <AppButton variant="secondary" size="lg" @click="router.push('/examples')">
                    看看其他岗位
                  </AppButton>
                </div>
              </div>

              <!-- 真实模板渲染，不是截图 -->
              <div class="lg:sticky lg:top-20">
                <div class="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <TemplatePreview :template-id="example.templateId" :content="previewContent ?? undefined" class="rounded-xl" />
                </div>
                <p class="text-2xs text-slate-500 mt-2 text-center">
                  以上为真实模板渲染效果，套用后可自由修改内容
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- 其他示例：内链有助于爬虫发现与用户继续浏览 -->
        <section class="py-10 bg-white border-t border-slate-200">
          <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-sm font-bold text-slate-900">其他岗位示例</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              <RouterLink
                v-for="other in others"
                :key="other.slug"
                :to="`/examples/${other.slug}`"
                class="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/40 transition"
              >
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-slate-800 truncate">{{ other.name }}</span>
                  <span class="block text-2xs text-slate-500 truncate">{{ other.seoTitle }}</span>
                </span>
                <ArrowRight class="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              </RouterLink>
            </div>
          </div>
        </section>
      </template>
    </main>

    <AppFooter />
  </div>
</template>
