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

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 触发防抖保存
  function triggerAutoSave() {
    saveStatus.value = 'unsaved';
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      await saveResume();
    }, 2500);
  }

  // 保存简历至本地或云端
  async function saveResume() {
    saveStatus.value = 'saving';
    try {
      // 1. 本地存储保底
      localStorage.setItem('open_resume_draft', JSON.stringify({
        id: id.value,
        title: title.value,
        templateId: templateId.value,
        content: content.value,
        themeConfig: themeConfig.value
      }));

      // 2. 若已登录且非纯本地草稿，同步至 Cloudflare D1
      if (authStore.isLoggedIn && id.value !== 'local-draft') {
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
    const targetHeight = 1120; // A4 纸 96DPI 标准高度 1123px，留出 3px 缓冲
    const height = currentHeight || (document.querySelector('.a4-print-target')?.clientHeight || 1123);

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
        // 轻微超页（溢出 < 10%），收拢模块与段落间距即可消除跨页
        themeConfig.value.sectionSpacing = Math.max(10, themeConfig.value.sectionSpacing - 4);
        themeConfig.value.paragraphSpacing = Math.max(3, themeConfig.value.paragraphSpacing - 2);
      }
      triggerAutoSave();
      return {
        success: true,
        message: '已智能压缩微调，成功收敛至标准单页！'
      };
    }

    // 2. 内容偏少（下半部大面积空白）：自适应丰满排版
    if (height < 920) {
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
    saveResume,
    resetToPreset,
    clearAllData,
    autoFitOnePage
  };
});
