import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetIdbCache, deleteDraft, getDraft, listDrafts, putDraft } from '../../src/utils/idb';

/**
 * jsdom 不带 IndexedDB。这里提供一个只实现本模块用到的那部分 API 的桩：
 * open → transaction → objectStore → get/put/delete/getAll。
 * 目的是验证我们自己的读写逻辑，而不是测试浏览器实现。
 */
type Row = Record<string, unknown> & { id: string };

function installFakeIdb() {
  const tables = new Map<string, Map<string, Row>>();

  const makeRequest = <T>(run: () => T) => {
    const request: any = {};
    queueMicrotask(() => {
      try {
        request.result = run();
        request.onsuccess?.();
      } catch (err) {
        request.error = err;
        request.onerror?.();
      }
    });
    return request;
  };

  const fakeIndexedDB = {
    open: (_name: string, _version: number) => {
      const request: any = { result: null };
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: (n: string) => tables.has(n) },
          createObjectStore: (n: string) => tables.set(n, new Map()),
          transaction: (storeName: string) => {
            const table = tables.get(storeName);
            if (!table) throw new Error(`no store: ${storeName}`);
            const store = {
              get: (id: string) => makeRequest(() => table.get(id)),
              put: (row: Row) => makeRequest(() => (table.set(row.id, row), row.id)),
              delete: (id: string) => makeRequest(() => (table.delete(id), undefined)),
              getAll: () => makeRequest(() => Array.from(table.values())),
            };
            return { objectStore: () => store };
          },
        };
        request.result = db;
        if (!tables.has('drafts')) {
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
  };

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: fakeIndexedDB,
  });

  return tables;
}

function draft(id: string, savedAt = Date.now()) {
  return {
    id,
    title: `简历 ${id}`,
    templateId: 'classic',
    content: { profile: { name: id } },
    themeConfig: { fontSize: 14 },
    savedAt,
  };
}

describe('IndexedDB 草稿存储', () => {
  beforeEach(() => {
    installFakeIdb();
    __resetIdbCache();
  });

  it('写入后可读回同一份草稿', async () => {
    const ok = await putDraft(draft('local_a'));

    expect(ok).toBe(true);
    const loaded = await getDraft('local_a');
    expect(loaded?.title).toBe('简历 local_a');
    expect(loaded?.templateId).toBe('classic');
  });

  it('同一 ID 再次写入会覆盖而不是追加', async () => {
    await putDraft(draft('local_a', 1));
    await putDraft({ ...draft('local_a', 2), title: '新标题' });

    const all = await listDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('新标题');
  });

  it('列出草稿时按保存时间倒序', async () => {
    await putDraft(draft('old', 1000));
    await putDraft(draft('new', 3000));
    await putDraft(draft('mid', 2000));

    const all = await listDrafts();
    expect(all.map((d) => d.id)).toEqual(['new', 'mid', 'old']);
  });

  it('删除后读不到，也不会出现在列表里', async () => {
    await putDraft(draft('local_a'));
    await deleteDraft('local_a');

    expect(await getDraft('local_a')).toBeNull();
    expect(await listDrafts()).toHaveLength(0);
  });

  it('读不存在的草稿返回 null 而不是抛错', async () => {
    await expect(getDraft('missing')).resolves.toBeNull();
  });

  it('浏览器禁用 IndexedDB 时所有操作都安全降级', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    __resetIdbCache();

    await expect(getDraft('x')).resolves.toBeNull();
    await expect(putDraft(draft('x'))).resolves.toBe(false);
    await expect(listDrafts()).resolves.toEqual([]);
  });

  it('打开数据库抛错时不会把异常抛给调用方', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: {
        open: () => {
          throw new Error('blocked by policy');
        },
      },
    });
    __resetIdbCache();

    await expect(putDraft(draft('x'))).resolves.toBe(false);
  });

  it('写入大体积内容（模拟 2MB 头像）不会失败', async () => {
    const big = { ...draft('big'), content: { avatar: 'x'.repeat(2 * 1024 * 1024) } };
    await expect(putDraft(big)).resolves.toBe(true);

    const loaded = await getDraft('big');
    expect((loaded?.content as { avatar: string }).avatar).toHaveLength(2 * 1024 * 1024);
  });
});

describe('旧草稿迁移到 IndexedDB', () => {
  beforeEach(() => {
    installFakeIdb();
    __resetIdbCache();
    localStorage.clear();
  });

  it('把 open_resume_draft:* 迁到 IDB，并保留 localStorage 作为同步缓存', async () => {
    const { useResumeStore } = await import('../../src/stores/resume');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());

    localStorage.setItem(
      'open_resume_draft:local_old',
      JSON.stringify({
        title: '旧草稿',
        templateId: 'geek',
        content: { profile: { name: '旧用户' } },
        themeConfig: { fontSize: 13 },
        savedAt: 1000,
      })
    );

    const store = useResumeStore();
    const migrated = await store.migrateLegacyDrafts();

    expect(migrated).toBe(1);

    const record = await getDraft('local_old');
    expect(record?.title).toBe('旧草稿');
    expect(record?.templateId).toBe('geek');

    // 原键必须保留：`loadLocalDraft` 依赖它做首屏同步渲染，
    // 删掉会让下次启动读不到缓存，demo 路径随即重置并覆盖 IDB。
    expect(localStorage.getItem('open_resume_draft:local_old')).toBeTruthy();

    // 迁移后仍能从本地同步恢复内容
    store.id = 'other';
    expect(store.loadLocalDraft('local_old')).toBe(true);
    expect(store.content.profile.name).toBe('旧用户');
  });

  it('重复执行迁移是幂等的', async () => {
    const { useResumeStore } = await import('../../src/stores/resume');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());

    localStorage.setItem(
      'open_resume_draft:local_x',
      JSON.stringify({ title: 'x', content: { a: 1 }, savedAt: 1 })
    );

    const store = useResumeStore();
    expect(await store.migrateLegacyDrafts()).toBe(1);
    expect(await store.migrateLegacyDrafts()).toBe(0);
  });

  it('IDB 里已有更新的版本时不覆盖', async () => {
    const { useResumeStore } = await import('../../src/stores/resume');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());

    await putDraft({ ...draft('local_y', 5000), title: 'IDB 新版本' });
    localStorage.setItem(
      'open_resume_draft:local_y',
      JSON.stringify({ title: '旧版本', content: { a: 1 }, savedAt: 1000 })
    );

    const store = useResumeStore();
    await store.migrateLegacyDrafts();

    const record = await getDraft('local_y');
    expect(record?.title).toBe('IDB 新版本');
  });

  it('清理过期备份时保留未过期与新迁移的备份', async () => {
    const { useResumeStore } = await import('../../src/stores/resume');
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());

    const old = JSON.stringify({ migratedAt: Date.now() - 8 * 24 * 3600 * 1000, payload: '{}' });
    const fresh = JSON.stringify({ migratedAt: Date.now(), payload: '{}' });
    localStorage.setItem('legacy:old', old);
    localStorage.setItem('legacy:fresh', fresh);

    const store = useResumeStore();
    const removed = store.pruneLegacyBackups();

    expect(removed).toBe(1);
    expect(localStorage.getItem('legacy:old')).toBeNull();
    expect(localStorage.getItem('legacy:fresh')).toBeTruthy();
  });
});

describe('草稿加载优先级', () => {
  beforeEach(() => {
    installFakeIdb();
    __resetIdbCache();
    localStorage.clear();
    vi.resetModules();
  });

  it('localStorage 有缓存时同步返回，IDB 更新版本随后覆盖', async () => {
    const { useResumeStore } = await import('../../src/stores/resume');
    const { createPinia, setActivePinia } = await import('pinia');
    const { nextTick } = await import('vue');
    setActivePinia(createPinia());

    // IDB 里是更新的版本
    await putDraft({
      ...draft('local_z', 9000),
      title: 'IDB 标题',
      content: { profile: { name: 'IDB' } },
    });
    // localStorage 是较旧的缓存
    localStorage.setItem(
      'open_resume_draft:local_z',
      JSON.stringify({
        title: '缓存标题',
        content: { profile: { name: '缓存' } },
        savedAt: 1000,
      })
    );

    const store = useResumeStore();
    const restored = store.loadLocalDraft('local_z');

    // 同步阶段用缓存，保证首屏立刻有内容
    expect(restored).toBe(true);
    expect(store.title).toBe('缓存标题');

    // 异步阶段被 IDB 的更新版本覆盖
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    expect(store.title).toBe('IDB 标题');
  });
});
