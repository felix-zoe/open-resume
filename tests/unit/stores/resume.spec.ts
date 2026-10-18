import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useResumeStore } from '../../../src/stores/resume';
import { useAuthStore } from '../../../src/stores/auth';

function login() {
  const auth = useAuthStore();
  auth.setAuth('tok', { id: 'u1', email: 'a@b.com', nickname: 'n' });
}

const okPut = () =>
  new Response(JSON.stringify({ code: 0, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

describe('resume store 自动保存', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('暂停期间编辑不产生任何保存请求，恢复后编辑正常保存', async () => {
    const fetchMock = vi.fn(async () => okPut());
    vi.stubGlobal('fetch', fetchMock);
    login();

    const store = useResumeStore();
    store.id = 'res_1';

    // 暂停期间（云端加载中）的编辑会被加载结果覆盖，因此不触发保存
    const resume = store.suspendAutoSave();
    store.content.profile.name = '暂停中编辑';
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();

    resume();
    store.content.profile.name = '恢复后编辑';
    await vi.advanceTimersByTimeAsync(3000);

    // 恢复后 2.5s 内只发一次 PUT，且内容是最新值
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.content.profile.name).toBe('恢复后编辑');
  });

  it('引用计数：多层暂停需全部释放后才恢复保存', async () => {
    const fetchMock = vi.fn(async () => okPut());
    vi.stubGlobal('fetch', fetchMock);
    login();

    const store = useResumeStore();
    store.id = 'res_1';

    const a = store.suspendAutoSave();
    const b = store.suspendAutoSave();
    a();
    store.content.profile.name = '仍暂停';
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();

    b();
    store.content.profile.name = '恢复';
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('重复释放同一把锁不会把计数减成负数', () => {
    const store = useResumeStore();
    const resume = store.suspendAutoSave();
    resume();
    resume();
    expect(store.isAutoSavePaused).toBe(false);
  });

  it('连续编辑只产生一次在途保存，尾随一次补存', async () => {
    let resolveFirst: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn(() => {
      if (fetchMock.mock.calls.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve(okPut());
    });
    vi.stubGlobal('fetch', fetchMock);
    login();

    const store = useResumeStore();
    store.id = 'res_1';

    // 第一次保存进入在途状态
    const first = store.saveResume();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 在途期间连续触发两次保存
    void store.saveResume();
    void store.saveResume();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst!(okPut());
    await first;

    // 尾随保存补跑一次，不会并发
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('本地存储配额不足不阻断云端保存', async () => {
    const fetchMock = vi.fn(async () => okPut());
    vi.stubGlobal('fetch', fetchMock);
    login();

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    const store = useResumeStore();
    store.id = 'res_1';

    await store.saveResume();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.saveStatus).toBe('saved');
    setItem.mockRestore();
  });

  it('本地草稿不向云端发送 PUT', async () => {
    const fetchMock = vi.fn(async () => okPut());
    vi.stubGlobal('fetch', fetchMock);
    login();

    const store = useResumeStore();
    store.id = 'local_abc';
    await store.saveResume();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('open_resume_draft:local_abc')).toBeTruthy();
  });

  it('loadResumeData 深拷贝，外部对象后续修改不影响 store', () => {
    const store = useResumeStore();
    const incoming = JSON.parse(JSON.stringify(store.content));
    incoming.profile.name = '云端名字';

    store.loadResumeData({ id: 'res_1', content: incoming });
    incoming.profile.name = '被外部改了';

    expect(store.content.profile.name).toBe('云端名字');
  });
});
