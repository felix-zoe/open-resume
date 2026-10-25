import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useAuthForm } from '../../../src/composables/useAuthForm';
import { useResumeStore } from '../../../src/stores/resume';
import { resolveChoice, useChoiceState } from '../../../src/composables/useChoice';

function makeRouter() {
  const Blank = defineComponent({ render: () => h('div') });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/editor/:id', name: 'Editor', component: Blank },
      { path: '/dashboard', name: 'Dashboard', component: Blank },
      { path: '/login', name: 'Login', component: Blank }
    ]
  });
  return router;
}

/** 在真实组件上下文中使用 composable（useRouter/useRoute 需要） */
function mountWithForm(router: ReturnType<typeof makeRouter>) {
  let api!: ReturnType<typeof useAuthForm>;
  const onDraftChoicePending = vi.fn();
  const Host = defineComponent({
    setup() {
      api = useAuthForm({ mode: () => 'login', onDraftChoicePending });
      return () => h('div');
    }
  });
  const wrapper = mount(Host, { global: { plugins: [router] } });
  return { wrapper, api, onDraftChoicePending };
}

/** 等「草稿是否同步」选择框挂上后作答 */
async function answerDraftChoice(value: 'sync' | 'keep-local' | null) {
  for (let i = 0; i < 20; i += 1) {
    await nextTick();
    if (useChoiceState().value) break;
  }
  resolveChoice(value);
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

// 必须每次新建：Response 的 body 只能读一次，复用会让后续用例拿到空响应
const loginOk = () =>
  jsonResponse({
    code: 0,
    data: { token: 'tok', user: { id: 'u1', email: 'a@b.com', nickname: 'n' } }
  });

describe('useAuthForm 登录迁移', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    sessionStorage.clear();
    resolveChoice(null);
  });

  it('登录后先询问，选择同步才迁移本地草稿并替换编辑器 URL', async () => {
    const router = makeRouter();
    await router.push('/editor/demo');
    await router.isReady();

    const resumeStore = useResumeStore();
    resumeStore.id = 'demo';
    resumeStore.title = '我的草稿';
    // 真正写过一次本地草稿，才算「有待同步的草稿」
    resumeStore.persistLocalDraft();

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/login') return loginOk();
      if (url === '/api/resumes') {
        return jsonResponse({ code: 0, data: { id: 'res_x' } });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api, onDraftChoicePending } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const pending = api.submit();
    await answerDraftChoice('sync');
    const result = await pending;
    await nextTick();

    // 弹窗宿主需要先关掉自己，否则两个弹窗叠加点不到
    expect(onDraftChoicePending).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.draftChoice).toBe('sync');
    expect(resumeStore.id).toBe('res_x');
    expect(router.currentRoute.value.params.id).toBe('res_x');
    // 旧草稿 key 被清理
    expect(localStorage.getItem('open_resume_draft:demo')).toBeNull();
    expect(localStorage.getItem('open_resume_draft:res_x')).toBeTruthy();
  });

  it('选择「仅保留本地」时不上传、不改 URL', async () => {
    const router = makeRouter();
    await router.push('/editor/demo');
    await router.isReady();

    const resumeStore = useResumeStore();
    resumeStore.id = 'demo';
    resumeStore.title = '我的草稿';
    resumeStore.persistLocalDraft();

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/login') return loginOk();
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const pending = api.submit();
    await answerDraftChoice('keep-local');
    const result = await pending;
    await nextTick();

    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(false);
    expect(result.draftChoice).toBe('keep-local');
    expect(fetchMock).toHaveBeenCalledTimes(1); // 只有登录请求
    expect(resumeStore.id).toBe('demo');
    expect(router.currentRoute.value.params.id).toBe('demo');
  });

  it('没有本地草稿时登录不询问，也不会凭空建一份云端简历', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/login') return loginOk();
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api, onDraftChoicePending } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const result = await api.submit();

    expect(result.ok).toBe(true);
    expect(onDraftChoicePending).not.toHaveBeenCalled();
    expect(useChoiceState().value).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('迁移失败时不跳转、不清本地草稿', async () => {
    const router = makeRouter();
    await router.push('/editor/demo');
    await router.isReady();

    const resumeStore = useResumeStore();
    resumeStore.id = 'demo';
    resumeStore.persistLocalDraft();

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/auth/login') return loginOk();
      return jsonResponse({ code: 50001, message: '数据库异常' }, 500);
    }));

    const { api } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const pending = api.submit();
    await answerDraftChoice('sync');
    const result = await pending;
    await nextTick();

    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(false);
    expect(resumeStore.id).toBe('demo');
    expect(router.currentRoute.value.params.id).toBe('demo');
    expect(localStorage.getItem('open_resume_draft:demo')).toBeTruthy();
  });

  it('表单校验失败不发起请求', async () => {
    const router = makeRouter();
    await router.push('/login');
    await router.isReady();

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { api } = mountWithForm(router);
    api.email.value = 'not-an-email';
    api.password.value = 'secret123';

    const result = await api.submit();

    expect(result.ok).toBe(false);
    expect(api.errorMsg.value).toContain('电子邮箱');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
