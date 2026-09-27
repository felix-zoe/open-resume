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
    clearAllData
  };
});
