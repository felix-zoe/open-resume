import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useResumes } from '../../src/composables/useResumes';
import { useToast } from '../../src/composables/useToast';
import { resolveConfirm } from '../../src/composables/useConfirm';
import { __resetUnauthorizedState, setUnauthorizedHandler } from '../../src/utils/http';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const ok = (data: unknown) => jsonResponse({ code: 0, message: 'success', data });

interface Call {
  url: string;
  init: RequestInit;
}

/** 按 URL 分派的 fetch 桩，同时记录全部调用 */
function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return { calls, mock };
}

const baseList = [
  { id: 'res_1', title: '前端简历', templateId: 'classic', isPublic: 1, updatedAt: 1_700_000_100 },
  { id: 'res_2', title: '后端简历', templateId: 'modern', isPublic: 0, updatedAt: 1_700_000_000 }
];

describe('useResumes', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetUnauthorizedState();
    setUnauthorizedHandler(null);
    useToast().clear();
    vi.unstubAllGlobals();
  });

  it('挂载只发 1 次列表 + 1 次汇总，并按 id 合并统计', async () => {
    const { calls } = stubFetch((url) => {
      if (url === '/api/resumes') return ok(baseList);
      if (url === '/api/analytics/overview') {
        return ok([
          { resumeId: 'res_1', totalViews: 12, avgDuration: 34.6, totalDownloads: 2 },
          { resumeId: 'res_2', totalViews: 0, avgDuration: 0, totalDownloads: 0 }
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });

    const { resumes, load, loading } = useResumes();
    const promise = load();
    expect(loading.value).toBe(true);
    await promise;

    expect(loading.value).toBe(false);
    expect(calls.map((c) => c.url).sort()).toEqual(['/api/analytics/overview', '/api/resumes']);
    expect(resumes.value).toHaveLength(2);
    expect(resumes.value[0].stats).toEqual({ totalViews: 12, avgDuration: 35, totalDownloads: 2 });
    // 汇总缺失的简历降级为 0，而不是 undefined
    expect(resumes.value[1].stats).toEqual({ totalViews: 0, avgDuration: 0, totalDownloads: 0 });
  });

  it('汇总接口失败时列表仍可用', async () => {
    stubFetch((url) => {
      if (url === '/api/resumes') return ok(baseList);
      return jsonResponse({ code: 50001, message: '汇总失败', data: null }, 500);
    });

    const { resumes, load, errorMsg } = useResumes();
    await load();

    expect(errorMsg.value).toBe('');
    expect(resumes.value).toHaveLength(2);
    expect(resumes.value[0].stats.totalViews).toBe(0);
  });

  it('列表失败时保留错误信息且不发第二次汇总请求以外的请求', async () => {
    const { calls } = stubFetch(() =>
      jsonResponse({ code: 50002, message: '数据库异常', data: null }, 500)
    );

    const { resumes, load, errorMsg } = useResumes();
    await load();

    expect(errorMsg.value).toBe('数据库异常');
    expect(resumes.value).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('重命名只发 PATCH { title }，不使用 PUT', async () => {
    const { calls } = stubFetch((url, init) => {
      if (url === '/api/resumes') return ok(baseList);
      if (url === '/api/analytics/overview') return ok([]);
      if (url === '/api/resumes/res_1' && init.method === 'PATCH') {
        return ok({ id: 'res_1', title: '新标题', updatedAt: 1_700_000_200 });
      }
      throw new Error(`unexpected ${init.method} ${url}`);
    });

    const { resumes, load, rename } = useResumes();
    await load();

    const target = resumes.value[0];
    const done = await rename(target, '  新标题  ');
    await nextTick();

    expect(done).toBe(true);
    expect(target.title).toBe('新标题');
    expect(target.updatedAt).toBe(1_700_000_200);

    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(patch?.url).toBe('/api/resumes/res_1');
    expect(JSON.parse(String(patch?.init.body))).toEqual({ title: '新标题' });
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('重命名失败时回滚标题', async () => {
    stubFetch((url, init) => {
      if (url === '/api/resumes') return ok(baseList);
      if (url === '/api/analytics/overview') return ok([]);
      if (init.method === 'PATCH') return jsonResponse({ code: 50001, message: '更新失败', data: null }, 500);
      throw new Error(`unexpected ${url}`);
    });

    const { resumes, load, rename } = useResumes();
    await load();
    const target = resumes.value[0];

    const done = await rename(target, '新标题');

    expect(done).toBe(false);
    expect(target.title).toBe('前端简历');
  });

  it('标题为空或超过 100 字时不发请求', async () => {
    const { calls } = stubFetch((url) => {
      if (url === '/api/resumes') return ok(baseList);
      return ok([]);
    });

    const { resumes, load, rename } = useResumes();
    await load();
    const before = calls.length;

    expect(await rename(resumes.value[0], '   ')).toBe(false);
    expect(await rename(resumes.value[0], 'x'.repeat(101))).toBe(false);
    expect(calls).toHaveLength(before);
  });

  it('删除在确认后才发请求，并移除本地行', async () => {
    const { calls } = stubFetch((url, init) => {
      if (url === '/api/resumes') return ok(baseList);
      if (url === '/api/analytics/overview') return ok([]);
      if (init.method === 'DELETE') return ok({ id: 'res_1' });
      throw new Error(`unexpected ${url}`);
    });

    const { resumes, load, remove } = useResumes();
    await load();

    const pending = remove(resumes.value[0]);
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

    resolveConfirm(false);
    await expect(pending).resolves.toBe(false);
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(resumes.value).toHaveLength(2);

    const second = remove(resumes.value[0]);
    resolveConfirm(true);
    await expect(second).resolves.toBe(true);

    expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(1);
    expect(resumes.value.map((r) => r.id)).toEqual(['res_2']);
  });

  it('totals 汇总全部简历的浏览与下载', async () => {
    stubFetch((url) => {
      if (url === '/api/resumes') return ok(baseList);
      return ok([
        { resumeId: 'res_1', totalViews: 5, avgDuration: 10, totalDownloads: 1 },
        { resumeId: 'res_2', totalViews: 7, avgDuration: 20, totalDownloads: 2 }
      ]);
    });

    const { load, totals, isEmpty } = useResumes();
    await load();

    expect(totals.value).toEqual({ views: 12, downloads: 3 });
    expect(isEmpty.value).toBe(false);
  });

  it('空列表标记 isEmpty', async () => {
    stubFetch((url) => (url === '/api/resumes' ? ok([]) : ok([])));

    const { load, isEmpty, loaded } = useResumes();
    expect(isEmpty.value).toBe(false); // 尚未加载
    await load();

    expect(loaded.value).toBe(true);
    expect(isEmpty.value).toBe(true);
  });
});
