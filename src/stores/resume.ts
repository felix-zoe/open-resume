import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { ResumeContent, ThemeConfig } from '../types/resume';
import { DEFAULT_RESUME_CONTENT, DEFAULT_THEME_CONFIG } from '../utils/presets';
import { useAuthStore } from './auth';

export const useResumeStore = defineStore('resume', () => {
  const authStore = useAuthStore();

  const id = ref<string>('local-draft');
  const title = ref<string>('资深前端研发工程师-张小凡');
  const templateId = ref<string>('classic');

  // 深拷贝默认数据，防止引用污染
  const content = ref<ResumeContent>(JSON.parse(JSON.stringify(DEFAULT_RESUME_CONTENT)));
  const themeConfig = ref<ThemeConfig>(JSON.parse(JSON.stringify(DEFAULT_THEME_CONFIG)));

  const zoom = ref<number>(1);
  const saveStatus = ref<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const lastSavedTime = ref<string>('刚刚');

  // 控制加载云端/切换简历时静默暂停自动保存，避免竞态覆盖
  const isAutoSavePaused = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 触发防抖保存
  function triggerAutoSave() {
    if (isAutoSavePaused.value) return;
    saveStatus.value = 'unsaved';
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      await saveResume();
    }, 2500);
  }

  // 获取指定简历的本地草稿 Storage Key
  function getDraftKey(resumeId: string): string {
    return `open_resume_draft:${resumeId}`;
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

  // 安全加载外部数据（原子化替换，配合锁暂停自动保存）
  function loadResumeData(data: {
    id: string;
    title?: string;
    templateId?: string;
    content?: ResumeContent;
    themeConfig?: ThemeConfig;
  }) {
    isAutoSavePaused.value = true;
    if (debounceTimer) clearTimeout(debounceTimer);

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
    // 延迟解除保存锁，防止 watch 的响应队列立即触发误保存
    setTimeout(() => {
      isAutoSavePaused.value = false;
    }, 400);
  }

  // 保存简历至本地或云端
  async function saveResume() {
    saveStatus.value = 'saving';
    try {
      // 1. 本地存储保底：按简历 ID 独立保存
      const currentDraft = {
        id: id.value,
        title: title.value,
        templateId: templateId.value,
        content: content.value,
        themeConfig: themeConfig.value,
        savedAt: Date.now()
      };
      localStorage.setItem(getDraftKey(id.value), JSON.stringify(currentDraft));
      // 兼容老单机草稿 key
      if (id.value === 'local-draft') {
        localStorage.setItem('open_resume_draft', JSON.stringify(currentDraft));
      }

      // 2. 若已登录且属于真实云端简历，同步至 Cloudflare D1
      if (authStore.isLoggedIn && id.value !== 'local-draft' && id.value !== 'demo') {
        const res = await fetch(`/api/resumes/${id.value}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          },
          body: JSON.stringify({
            title: title.value,
            templateId: templateId.value,
            content: content.value,
            themeConfig: themeConfig.value
          })
        });
        if (!res.ok) throw new Error('云端保存失败');
      }

      saveStatus.value = 'saved';
      const now = new Date();
      lastSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    } catch (err) {
      console.error(err);
      saveStatus.value = 'error';
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
    const targetHeight = 1122; // A4 纸 96DPI 标准高度 1122.52px
    // 准确读取内部内容实际 scrollHeight，避免纸张自身的 min-height: 297mm 干扰测量
    let height = currentHeight;
    if (!height) {
      const innerTarget = document.querySelector('.a4-print-target > div') as HTMLElement | null;
      height = innerTarget?.scrollHeight || document.querySelector('.a4-print-target')?.scrollHeight || targetHeight;
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
    zoom,
    saveStatus,
    lastSavedTime,
    isAutoSavePaused,
    loadResumeData,
    loadLocalDraft,
    saveResume,
    resetToPreset,
    clearAllData,
    autoFitOnePage
  };
});
