import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useAuthForm } from '../../../src/composables/useAuthForm';
import { useResumeStore } from '../../../src/stores/resume';

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
  const Host = defineComponent({
    setup() {
      api = useAuthForm({ mode: () => 'login' });
      return () => h('div');
    }
  });
  const wrapper = mount(Host, { global: { plugins: [router] } });
  return { wrapper, api };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('useAuthForm 登录迁移', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('登录成功后迁移本地草稿并替换编辑器 URL', async () => {
    const router = makeRouter();
    await router.push('/editor/demo');
    await router.isReady();

    const resumeStore = useResumeStore();
    resumeStore.id = 'demo';
    resumeStore.title = '我的草稿';

    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/auth/login') {
        return jsonResponse({ code: 0, data: { token: 'tok', user: { id: 'u1', email: 'a@b.com', nickname: 'n' } } });
      }
      if (url === '/api/resumes') {
        return jsonResponse({ code: 0, data: { id: 'res_x' } });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const result = await api.submit();
    await nextTick();

    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(true);
    expect(resumeStore.id).toBe('res_x');
    expect(router.currentRoute.value.params.id).toBe('res_x');
    // 旧草稿 key 被清理
    expect(localStorage.getItem('open_resume_draft:demo')).toBeNull();
    expect(localStorage.getItem('open_resume_draft:res_x')).toBeTruthy();
  });

  it('迁移失败时不跳转、不清本地草稿', async () => {
    const router = makeRouter();
    await router.push('/editor/demo');
    await router.isReady();

    const resumeStore = useResumeStore();
    resumeStore.id = 'demo';
    localStorage.setItem('open_resume_draft:demo', JSON.stringify({ id: 'demo' }));

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/auth/login') {
        return jsonResponse({ code: 0, data: { token: 'tok', user: { id: 'u1', email: 'a@b.com', nickname: 'n' } } });
      }
      return jsonResponse({ code: 50001, message: '数据库异常' }, 500);
    }));

    const { api } = mountWithForm(router);
    api.email.value = 'a@b.com';
    api.password.value = 'secret123';

    const result = await api.submit();
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
