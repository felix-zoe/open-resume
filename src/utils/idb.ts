/**
 * 游客草稿的 IndexedDB 存储。
 *
 * 为什么不用 localStorage：
 * - 配额只有 5MB 左右，一张 2MB 头像的 base64 就能把整份草稿顶掉；
 * - 每次按键都同步序列化整份 JSON，主线程会卡；
 * - 写失败（QuotaExceededError）时没有降级空间。
 *
 * IDB 可以存数十 MB，且写入是异步的。这里只负责“存取一份草稿”，
 * 不含任何业务逻辑——冲突合并、迁移策略都在 store 里。
 */

const DB_NAME = 'open-resume';
const DB_VERSION = 1;
const DRAFT_STORE = 'drafts';

export interface DraftRecord {
  id: string;
  title: string;
  templateId: string;
  content: unknown;
  themeConfig: unknown;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** 打开数据库；浏览器不支持或被禁用时返回 null，调用方回退到 localStorage */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // 某些隐私模式下 open 会一直挂起，不能让草稿保存永久卡住
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let request: IDBRequest<T>;
        try {
          const tx = db.transaction(DRAFT_STORE, mode);
          request = run(tx.objectStore(DRAFT_STORE));
        } catch {
          resolve(null);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      })
  );
}

/** 读取一份草稿 */
export function getDraft(id: string): Promise<DraftRecord | null> {
  return withStore<DraftRecord | undefined>('readonly', (store) => store.get(id)).then(
    (record) => record ?? null
  );
}

/** 写入（或覆盖）一份草稿 */
export function putDraft(record: DraftRecord): Promise<boolean> {
  return withStore<IDBValidKey>('readwrite', (store) => store.put(record)).then(
    (key) => key !== null
  );
}

/** 删除一份草稿 */
export function deleteDraft(id: string): Promise<boolean> {
  return withStore<undefined>('readwrite', (store) => store.delete(id)).then(
    (result) => result !== null
  );
}

/** 列出全部草稿，按保存时间倒序 */
export function listDrafts(): Promise<DraftRecord[]> {
  return withStore<DraftRecord[]>('readonly', (store) => store.getAll()).then((records) => {
    if (!records) return [];
    return [...records].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  });
}

/** 仅测试使用：丢弃缓存的连接，让下一次调用重新打开 */
export function __resetIdbCache() {
  dbPromise = null;
}
