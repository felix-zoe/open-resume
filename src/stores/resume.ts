import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import { A4_HEIGHT_PX, RESUME_DOC_SELECTOR } from '../utils/a4';
import { apiFetch } from '../utils/http';
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

  const zoom = ref<number>(1);
  const saveStatus = ref<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const lastSavedTime = ref<string>('刚刚');

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
    options: { title?: string; templateId?: string } = {}
  ) {
    id.value = targetId;
    content.value = JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT));
    themeConfig.value = JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG));
    title.value = options.title ?? '未命名简历';
    if (options.templateId) templateId.value = options.templateId;
    saveStatus.value = 'saved';
    persistLocalDraft();
  }

  // 从本地恢复草稿
  function loadLocalDraft(targetId: string): boolean {
    try {
      const raw = localStorage.getItem(getDraftKey(targetId)) || (targetId === 'local-draft' ? localStorage.getItem('open_resume_draft') : null);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.content) {
        loadResumeData({
          id: targetId,
          title: parsed.title,
          templateId: parsed.templateId,
          content: parsed.content,
          themeConfig: parsed.themeConfig
        });
        return true;
      }
    } catch (e) {
      console.warn('读取本地草稿失败:', e);
    }
    return false;
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
  }) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    id.value = data.id;
    if (data.title) title.value = data.title;
    if (data.templateId) templateId.value = data.templateId;
    if (data.content) {
      content.value = JSON.parse(JSON.stringify(data.content));
    }
    if (data.themeConfig) {
      themeConfig.value = JSON.parse(JSON.stringify(data.themeConfig));
    }

    saveStatus.value = 'saved';
  }

  /** 本地落盘：失败（如 QuotaExceededError）只记录，不影响云端保存 */
  function writeLocalDraft(): boolean {
    const currentDraft = {
      id: id.value,
      title: title.value,
      templateId: templateId.value,
      content: content.value,
      themeConfig: themeConfig.value,
      savedAt: Date.now()
    };
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

  // 保存串行化：在途时只标记一次“待保存”，避免连续编辑产生并发 PUT
  let isSaving = false;
  let pendingSave = false;

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

      saveStatus.value = 'saved';
      const now = new Date();
      lastSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    } catch (err) {
      console.error(err);
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

  // 清空所有模块内容
  function clearAllData() {
    content.value = {
      profile: {
        name: '姓名',
        title: '求职意向',
        email: '',
        phone: '',
        showAvatar: false
      },
      modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
      modules: {
        work: { visible: true, title: '工作经历', items: [] },
        projects: { visible: true, title: '项目经历', items: [] },
        skills: { visible: true, title: '专业技能', items: [] },
        education: { visible: true, title: '教育背景', items: [] },
        custom: { visible: false, title: '自定义模块', items: [] }
      }
    };
    triggerAutoSave();
  }

  // 智能卡页（Auto-Fit）算法：自动解算最佳间距与字号，完美将内容收敛至单页 A4
  function autoFitOnePage(currentHeight?: number): { success: boolean; message: string } {
    const targetHeight = A4_HEIGHT_PX;
    // 测量内容节点而非纸张：纸张的 min-height: 297mm 会让测量值恒等于一页
    let height = currentHeight;
    if (!height) {
      const doc = document.querySelector(`.a4-print-target ${RESUME_DOC_SELECTOR}`) as HTMLElement | null;
      height = doc?.scrollHeight || targetHeight;
    }

    // 黄金单页阈值容差 (±15px 内无需进一步调整)
    if (Math.abs(height - targetHeight) <= 15) {
      return {
        success: true,
        message: '当前经历正处于黄金单页排版比例，无需调整。'
      };
    }

    // 1. 内容溢出超页：自适应收紧
    if (height > targetHeight) {
      const overflowRatio = (height - targetHeight) / targetHeight;
      if (overflowRatio > 0.45) {
        return {
          success: false,
          message: '当前经历内容超出 1 页较多，建议精简经历或分为两页呈现'
        };
      }

      if (overflowRatio > 0.25) {
        themeConfig.value.fontSize = Math.max(12.5, themeConfig.value.fontSize - 1);
        themeConfig.value.lineHeight = Math.max(1.35, Number((themeConfig.value.lineHeight - 0.1).toFixed(2)));
        themeConfig.value.sectionSpacing = Math.max(10, themeConfig.value.sectionSpacing - 6);
        themeConfig.value.paragraphSpacing = Math.max(3, themeConfig.value.paragraphSpacing - 3);
        themeConfig.value.pagePadding = Math.max(14, themeConfig.value.pagePadding - 3);
      } else if (overflowRatio > 0.1) {
        themeConfig.value.fontSize = Math.max(13, themeConfig.value.fontSize - 0.5);
        themeConfig.value.lineHeight = Math.max(1.4, Number((themeConfig.value.lineHeight - 0.05).toFixed(2)));
        themeConfig.value.sectionSpacing = Math.max(12, themeConfig.value.sectionSpacing - 4);
        themeConfig.value.paragraphSpacing = Math.max(4, themeConfig.value.paragraphSpacing - 2);
        themeConfig.value.pagePadding = Math.max(16, themeConfig.value.pagePadding - 2);
      } else {
        // 轻微超页（溢出 <= 10%），收拢模块与段落间距即可消除跨页
        themeConfig.value.sectionSpacing = Math.max(10, themeConfig.value.sectionSpacing - 4);
        themeConfig.value.paragraphSpacing = Math.max(3, themeConfig.value.paragraphSpacing - 2);
      }
      triggerAutoSave();
      return {
        success: true,
        message: '已智能压缩微调，成功收敛至标准单页！'
      };
    }

    // 2. 内容偏少（下半部留白）：自适应丰满排版
    if (height < 940) {
      themeConfig.value.fontSize = Math.min(15, themeConfig.value.fontSize + 0.5);
      themeConfig.value.lineHeight = Math.min(1.65, Number((themeConfig.value.lineHeight + 0.05).toFixed(2)));
      themeConfig.value.sectionSpacing = Math.min(24, themeConfig.value.sectionSpacing + 6);
      themeConfig.value.paragraphSpacing = Math.min(10, themeConfig.value.paragraphSpacing + 3);
      themeConfig.value.pagePadding = Math.min(24, themeConfig.value.pagePadding + 2);
      triggerAutoSave();
      return {
        success: true,
        message: '已自动丰满排版，单页视觉更充实！'
      };
    }

    return {
      success: true,
      message: '当前经历正处于黄金单页排版比例，无需调整。'
    };
  }

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
    isAutoSavePaused,
    suspendAutoSave,
    loadResumeData,
    loadLocalDraft,
    persistLocalDraft,
    createLocalId,
    createLocalDraft,
    saveResume,
    resetToPreset,
    clearAllData,
    autoFitOnePage
  };
});
