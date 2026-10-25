import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import {
  DEFAULT_EN_RESUME_CONTENT,
  DEFAULT_RESUME_CONTENT,
  DEFAULT_THEME_CONFIG,
  buildEmptyContent
} from '../utils/presets';
import { localizeModuleTitles, normalizeLocale } from '../i18n/resumeLabels';
import type { ResumeLocale } from '../../shared/types';
import { runAutoFit } from '../composables/useAutoFit';
import { apiFetch } from '../utils/http';
import { getDraft, listDrafts, putDraft, type DraftRecord } from '../utils/idb';
import { trackEvent } from '../utils/telemetry';
import { useAuthStore } from './auth';

export const useResumeStore = defineStore('resume', () => {
  const authStore = useAuthStore();

  const id = ref<string>('local-draft');
  const title = ref<string>('资深前端研发工程师-张小凡');
  const templateId = ref<string>('classic');

  // 深拷贝默认数据，防止引用污染
  const content = ref<ResumeContent>(JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)));
  const themeConfig = ref<ThemeConfig>(JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)));

  /**
   * 本地草稿：尚未落到云端，不能分享、也不能发 PUT 到 `/api/resumes/:id`。
   * `local-draft` 是旧版单例 ID，保留兼容。
   */
  const isLocalDraft = computed(
    () => id.value === 'demo' || id.value === 'local-draft' || id.value.startsWith('local_')
  );

  /**
   * 是否真的有一份「还没同步到云端」的草稿。
   *
   * 只看 `isLocalDraft` 不够：store 的初始 id 就是 `local-draft`，
   * 直接访问 `/login` 的用户从没打开过编辑器，登录后却会被当成有草稿，
   * 于是凭空创建一份默认内容的云端简历。这里要求确实写过本地草稿才算数。
   */
  const localDraftTouched = ref(false);
  const hasUnsavedLocalDraft = computed(() => isLocalDraft.value && localDraftTouched.value);

  const zoom = ref<number>(1);
  const saveStatus = ref<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const lastSavedTime = ref<string>('刚刚');
  /** 云端简历的公开状态；本地草稿恒为 0（无法分享） */
  const isPublic = ref<number>(0);

  /**
   * 自动保存暂停锁。
   *
   * 旧实现用 400ms 定时器解锁，慢网络下云端响应回来时锁早已释放，
   * 加载过程中的响应式写入会触发一次 PUT 把刚拉到的数据再写回去。
   * 现在改为 promise 作用域的引用计数：调用方用 try/finally 保证成对释放。
   */
  const pauseDepth = ref(0);
  const isAutoSavePaused = computed(() => pauseDepth.value > 0);

  function suspendAutoSave(): () => void {
    pauseDepth.value += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      pauseDepth.value = Math.max(0, pauseDepth.value - 1);
    };
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 触发防抖保存
  function triggerAutoSave() {
    if (isAutoSavePaused.value) return;
    saveStatus.value = 'unsaved';
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      await saveResume();
    }, 2500);
  }

  // 获取指定简历的本地草稿 Storage Key
  function getDraftKey(resumeId: string): string {
    return `open_resume_draft:${resumeId}`;
  }

  /** 同步落盘当前草稿，用于“新建/重置”这类需要立刻可见的场景 */
  function persistLocalDraft() {
    // 真正写过盘才算「有一份待处理的草稿」，否则登录时会为一个默认内容弹窗
    localDraftTouched.value = isLocalDraft.value;
    writeLocalDraft();
  }

  /** 生成游客草稿 ID（不使用 'local-draft' 单例，避免多份草稿互相覆盖） */
  function createLocalId(): string {
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `local_${uuid}`;
  }

  /** 新建一份本地草稿：先落 ID 与示例内容，再立刻写入 localStorage */
  function createLocalDraft(
    targetId: string,
    options: { title?: string; templateId?: string; locale?: string } = {}
  ) {
    id.value = targetId;
    // 游客直接进编辑器时给完整范文（能看到排版效果才知道这产品长什么样）；
    // 英文入口给英文范文，否则「英文简历」里躺着一段中文经历
    content.value = JSON.parse(
      JSON.stringify(
        normalizeLocale(options.locale) === 'en' ? DEFAULT_EN_RESUME_CONTENT : DEFAULT_RESUME_CONTENT
      )
    );
    themeConfig.value = JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG));
    title.value = options.title ?? '未命名简历';
    if (options.templateId) templateId.value = options.templateId;
    // 本地草稿不可能有公开状态；不重置会继承上一份云端简历的 isPublic
    isPublic.value = 0;
    saveStatus.value = 'saved';
    persistLocalDraft();
  }

  /** 同步读取 localStorage 里的旧草稿（迁移前格式，也是 IDB 不可用时的兜底） */
  function readLocalStorageDraft(targetId: string): DraftRecord | null {
    try {
      const raw =
        localStorage.getItem(getDraftKey(targetId)) ||
        (targetId === 'local-draft' ? localStorage.getItem('open_resume_draft') : null);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.content) return null;
      return {
        id: targetId,
        title: parsed.title,
        templateId: parsed.templateId,
        content: parsed.content,
        themeConfig: parsed.themeConfig,
        savedAt: Number(parsed.savedAt) || 0,
      };
    } catch (e) {
      console.warn('读取本地草稿失败:', e);
      return null;
    }
  }

  function applyDraft(targetId: string, draft: DraftRecord): boolean {
    if (!draft?.content) return false;
    loadResumeData({
      id: targetId,
      title: draft.title,
      templateId: draft.templateId,
      content: draft.content as ResumeContent,
      themeConfig: draft.themeConfig as ThemeConfig,
    });
    return true;
  }

  /**
   * 从本地恢复草稿。
   *
   * 同步返回：先读 localStorage（同步、快，保证首屏立即有内容），
   * 再异步用 IDB 里的更新版本覆盖——IDB 是主存储，localStorage 只是缓存。
   * 这样调用方不需要改成 async，也不会出现“IDB 没读完就先渲染默认数据”。
   */
  function loadLocalDraft(targetId: string): boolean {
    const cached = readLocalStorageDraft(targetId);
    const restored = cached ? applyDraft(targetId, cached) : false;

    // 异步补齐：IDB 里可能有比 localStorage 更新的版本
    void getDraft(targetId).then((record) => {
      if (!record) return;
      if (cached && record.savedAt <= cached.savedAt) return;
      // 用户已经切走或换了简历，丢弃过期响应
      if (id.value !== targetId) return;
      applyDraft(targetId, record);
    });

    return restored;
  }

  /** 列出全部本地草稿（供工作台“本地草稿”区块使用） */
  async function listLocalDrafts(): Promise<DraftRecord[]> {
    return listDrafts();
  }

  /**
   * 安全加载外部数据（原子化替换）。
   * 调用方需自行用 `suspendAutoSave()` 包住云端请求，避免请求期间的用户编辑丢失。
   */
  function loadResumeData(data: {
    id: string;
    title?: string;
    templateId?: string;
    content?: ResumeContent;
    themeConfig?: ThemeConfig;
    isPublic?: number;
  }) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    id.value = data.id;
    // 载入了本地草稿的内容 = 用户确实写过东西，登录时才值得问「要不要同步」
    localDraftTouched.value = isLocalDraft.value;
    if (data.title) title.value = data.title;
    if (data.templateId) templateId.value = data.templateId;
    if (data.content) {
      content.value = JSON.parse(JSON.stringify(data.content));
    }
    if (data.themeConfig) {
      themeConfig.value = JSON.parse(JSON.stringify(data.themeConfig));
    }
    isPublic.value = typeof data.isPublic === 'number' ? data.isPublic : 0;

    saveStatus.value = 'saved';
  }

  /**
   * 本地落盘。
   *
   * 主存储是 IndexedDB（容量大、异步、能放头像），localStorage 保留为同步缓存
   * 与 IDB 不可用时的兜底。任一路径失败都只记录，不影响云端保存。
   */
  function writeLocalDraft(): boolean {
    const currentDraft: DraftRecord = {
      id: id.value,
      title: title.value,
      templateId: templateId.value,
      content: content.value,
      themeConfig: themeConfig.value,
      savedAt: Date.now(),
    };

    // 异步写 IDB：不阻塞输入
    void putDraft(currentDraft);

    // 同步写 localStorage：保证下次打开能立刻渲染，也覆盖隐私模式下 IDB 被禁的情况
    try {
      localStorage.setItem(getDraftKey(id.value), JSON.stringify(currentDraft));
      if (id.value === 'local-draft') {
        localStorage.setItem('open_resume_draft', JSON.stringify(currentDraft));
      }
      return true;
    } catch (err) {
      console.warn('本地草稿写入失败（不影响云端保存）:', err);
      return false;
    }
  }

  /**
   * 把旧版 localStorage 草稿迁移到 IDB。
   *
   * 幂等：迁移后 localStorage 只保留只读备份（`legacy:` 前缀），
   * 下次启动不会再迁一遍；备份保留 7 天后由 `pruneLegacyBackups` 清理。
   */
  const LEGACY_PREFIX = 'legacy:';

  async function migrateLegacyDrafts(): Promise<number> {
    if (typeof localStorage === 'undefined') return 0;
    let migrated = 0;

    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(LEGACY_PREFIX)) continue;
        if (key === 'open_resume_draft' || key.startsWith('open_resume_draft:')) keys.push(key);
      }
    } catch {
      return 0;
    }

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed?.content) continue;

        const targetId = key === 'open_resume_draft' ? 'local-draft' : key.replace('open_resume_draft:', '');
        const existing = await getDraft(targetId);
        // 已有更新的记录就不覆盖
        if (existing && existing.savedAt >= (Number(parsed.savedAt) || 0)) continue;

        const ok = await putDraft({
          id: targetId,
          title: parsed.title ?? '未命名简历',
          templateId: parsed.templateId ?? 'classic',
          content: parsed.content,
          themeConfig: parsed.themeConfig,
          savedAt: Number(parsed.savedAt) || Date.now(),
        });
        if (!ok) continue;

        // 保留原 localStorage 键作为同步缓存，**不删除**。
        //
        // 早期实现把它降级成 `legacy:` 备份再删掉原键，但 `writeLocalDraft`
        // 仍会同步写 localStorage —— 两者语义冲突：下次启动时 `loadLocalDraft`
        // 读不到缓存会返回 false，demo 路径随即 `resetToPreset()` 并覆盖 IDB，
        // 迁移过的草稿就此丢失。IDB 是权威存储，localStorage 只是首屏缓存，
        // 保留它才能保证「先渲染缓存、再用 IDB 覆盖」这条链路成立。
        migrated += 1;
      } catch (e) {
        console.warn('旧草稿迁移失败:', key, e);
      }
    }

    return migrated;
  }

  /** 清理超过保留期的旧草稿只读备份（默认 7 天） */
  function pruneLegacyBackups(maxAgeMs = 7 * 24 * 60 * 60 * 1000): number {
    if (typeof localStorage === 'undefined') return 0;
    let removed = 0;
    try {
      const stale: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key?.startsWith(LEGACY_PREFIX)) stale.push(key);
      }

      const now = Date.now();
      for (const key of stale) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const migratedAt = Number(parsed?.migratedAt) || 0;
          // 没有时间戳的旧格式备份无法判断年龄，保留不动
          if (migratedAt > 0 && now - migratedAt > maxAgeMs) {
            localStorage.removeItem(key);
            removed += 1;
          }
        } catch {
          // 备份内容损坏，直接删掉
          localStorage.removeItem(key);
          removed += 1;
        }
      }
    } catch {
      // 隐私模式下 localStorage 可能抛错，忽略
    }
    return removed;
  }

  // 保存串行化：在途时只标记一次“待保存”，避免连续编辑产生并发 PUT
  let isSaving = false;
  let pendingSave = false;
  /** 本次会话是否已上报过「保存成功」 */
  let trackedSaveOk = false;

  async function saveResume(): Promise<void> {
    if (isSaving) {
      pendingSave = true;
      return;
    }

    isSaving = true;
    saveStatus.value = 'saving';
    try {
      // 1. 本地存储保底（独立 try/catch，配额不足不得阻断云端保存）
      writeLocalDraft();

      // 2. 若已登录且属于真实云端简历，同步至 Cloudflare D1
      if (authStore.isLoggedIn && !isLocalDraft.value) {
        const result = await apiFetch(`/api/resumes/${id.value}`, {
          method: 'PUT',
          body: {
            title: title.value,
            templateId: templateId.value,
            content: content.value,
            themeConfig: themeConfig.value
          }
        });
        if (!result.ok) throw new Error(result.message || '云端保存失败');
      }

      // 本次会话第一次保存成功才记一次：自动保存每 3 秒触发，
      // 逐次上报等于把埋点表写满，而「有没有人成功保存过」这个问题的答案不会变
      if (!trackedSaveOk) {
        trackedSaveOk = true;
        trackEvent('resume.save.ok');
      }
      saveStatus.value = 'saved';
      const now = new Date();
      lastSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    } catch (err) {
      console.error(err);
      trackEvent('resume.save.fail');
      saveStatus.value = 'error';
    } finally {
      isSaving = false;
      if (pendingSave) {
        pendingSave = false;
        // 在途期间有新的编辑：再跑一次，保证最后一次修改一定落盘
        if (!isAutoSavePaused.value) await saveResume();
      }
    }
  }

  // 重置为示例数据
  function resetToPreset() {
    content.value = JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT));
    themeConfig.value = JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG));
    title.value = '资深前端研发工程师-张小凡';
    triggerAutoSave();
  }

  // 清空所有模块内容（保留当前简历语言，英文简历清空后仍是英文骨架）
  function clearAllData() {
    content.value = buildEmptyContent(content.value.locale);
    triggerAutoSave();
  }

  /**
   * 切换简历语言。
   *
   * 只改「仍是默认值」的模块标题与空字段占位，用户写的内容一字不动——
   * 翻译用户自己写的经历是另一个产品（AI 改写），不该混进语言切换里。
   */
  function setLocale(next: ResumeLocale) {
    if (content.value.locale === next) return;
    content.value = {
      ...content.value,
      locale: next,
      modules: localizeModuleTitles(content.value.modules, next)
    };
    triggerAutoSave();
  }

  const locale = computed(() => normalizeLocale(content.value.locale));

  /**
   * 上一次自动排版前的主题快照。
   *
   * AutoFit 会连改多个参数，用户如果不满意，需要一个“撤销本次自动排版”的
   * 出口——否则只能手动把五个滑块逐一调回去。
   */
  const autoFitSnapshot = ref<ThemeConfig | null>(null);

  /**
   * 迭代式自动排版（RENDER-07）。
   *
   * 与旧实现的差别：
   * - 每轮改一个参数 → 等渲染 → 重新测量 → 再判断，而不是一次性改一组；
   * - 支持目标页数（1 页 / 2 页），不再只有“塞进一页”一种目标；
   * - 操作前保存快照，可撤销；
   * - 失败时给出超出高度，而不是只丢一句“建议精简”。
   */
  async function autoFitOnePage(targetPages = 1): Promise<{ success: boolean; message: string }> {
    const result = await runAutoFit(
      themeConfig.value,
      (patch) => {
        Object.assign(themeConfig.value, patch);
      },
      { targetPages }
    );

    if (result.snapshot) {
      autoFitSnapshot.value = result.snapshot;
      triggerAutoSave();
    }

    return { success: result.success, message: result.message };
  }

  /** 撤销最近一次自动排版；没有快照时返回 false */
  function undoAutoFit(): boolean {
    const snapshot = autoFitSnapshot.value;
    if (!snapshot) return false;
    themeConfig.value = JSON.parse(JSON.stringify(snapshot));
    autoFitSnapshot.value = null;
    triggerAutoSave();
    return true;
  }

  const canUndoAutoFit = computed(() => autoFitSnapshot.value !== null);

  // 监听内容与样式变更，自动进入防抖倒计时
  watch([content, themeConfig, title, templateId], () => {
    triggerAutoSave();
  }, { deep: true });

  return {
    id,
    title,
    templateId,
    content,
    themeConfig,
    isLocalDraft,
    zoom,
    saveStatus,
    lastSavedTime,
    isPublic,
    hasUnsavedLocalDraft,
    isAutoSavePaused,
    suspendAutoSave,
    loadResumeData,
    loadLocalDraft,
    listLocalDrafts,
    migrateLegacyDrafts,
    pruneLegacyBackups,
    persistLocalDraft,
    createLocalId,
    createLocalDraft,
    saveResume,
    resetToPreset,
    clearAllData,
    locale,
    setLocale,
    autoFitOnePage,
    undoAutoFit,
    canUndoAutoFit
  };
});
