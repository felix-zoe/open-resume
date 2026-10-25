import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useResumeStore } from '../stores/resume';
import { apiFetch } from '../utils/http';
import { askChoice } from './useChoice';
import { trackEvent } from '../utils/telemetry';

export type AuthMode = 'login' | 'register';

/** 登录后对本地草稿的处理方式：同步到云端，或继续只留在本机 */
export type DraftChoice = 'sync' | 'keep-local';

interface SubmitResult {
  ok: boolean;
  /** 登录/注册本身成功，但本地草稿迁移到云端失败 */
  migrated: boolean;
  /** 用户对本地草稿的选择；没有草稿时为 undefined */
  draftChoice?: DraftChoice;
  error?: string;
}

/**
 * 登录/注册共用逻辑。
 *
 * 同时修复了旧实现的两个问题：
 * 1. 迁移成功后只改 store.id 不改 URL，刷新就回到旧草稿；
 * 2. 迁移后旧草稿 key 仍留在 localStorage，下次再进 `/editor/demo` 会覆盖云端内容。
 */
export function useAuthForm(options: {
  mode: () => AuthMode;
  onSuccess?: (result: SubmitResult) => void;
  /**
   * 即将弹出「草稿是否同步」选择框。
   * 宿主是弹窗时需要先把自己关掉，否则两个弹窗会叠在一起、下面的按钮点不到。
   */
  onDraftChoicePending?: () => void;
}) {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();
  const resumeStore = useResumeStore();

  const email = ref('');
  const password = ref('');
  const nickname = ref('');
  const showPassword = ref(false);
  const loading = ref(false);
  const errorMsg = ref('');
  const emailTouched = ref(false);

  const isEmailValid = computed(() => {
    if (!email.value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value);
  });

  const passwordStrength = computed(() => {
    const val = password.value;
    if (!val) {
      return { score: 0, label: '', width: '0%', color: 'bg-slate-200', textClass: 'text-slate-400' };
    }
    let score = 0;
    if (val.length >= 6) score++;
    if (/[0-9]/.test(val) && /[a-zA-Z]/.test(val)) score++;
    if (val.length >= 10 || /[^A-Za-z0-9]/.test(val)) score++;

    if (score === 1) return { score: 1, label: '弱', width: '33%', color: 'bg-rose-500', textClass: 'text-rose-500' };
    if (score === 2) return { score: 2, label: '中等', width: '66%', color: 'bg-amber-500', textClass: 'text-amber-500' };
    return { score: 3, label: '强', width: '100%', color: 'bg-emerald-500', textClass: 'text-emerald-500' };
  });

  function validate(): string | null {
    if (!email.value || !password.value) return '请完整填写邮箱与密码';
    if (!isEmailValid.value) return '请输入合规的电子邮箱地址';
    if (password.value.length < 6) return '密码长度至少需为 6 位字符';
    return null;
  }

  /**
   * 登录成功后问用户：这份还没上云的草稿，是同步到云端还是只留在本机。
   *
   * 之前的实现是静默自动迁移：用户可能只是想在另一台设备上登录看看，
   * 结果本机草稿凭空变成了一份云端简历。弹窗把选择权交回去，
   * 关掉弹窗（返回 null）按「不改动」处理，也就是仅保留本地。
   */
  async function askDraftChoice(): Promise<DraftChoice> {
    if (!resumeStore.hasUnsavedLocalDraft) return 'keep-local';

    options.onDraftChoicePending?.();
    // 让宿主弹窗先完成关闭动画，再挂上选择框
    await nextTick();

    const choice = await askChoice({
      title: '这份本地草稿要同步到云端吗？',
      description:
        '你刚才编辑的简历目前只存在这台设备上。同步后可以在任何设备继续编辑，也能生成在线链接。',
      options: [
        {
          value: 'sync',
          label: '同步到云端',
          description: '在当前账号下新建一份简历，之后自动保存',
          tone: 'primary'
        },
        {
          value: 'keep-local',
          label: '仅保留本地',
          description: '不上传，草稿继续留在这台设备；清空浏览器数据会丢失'
        }
      ]
    });
    return choice === 'sync' ? 'sync' : 'keep-local';
  }

  /** 把当前本地草稿迁移成云端简历，成功后同步 URL */
  async function migrateLocalDraft(token: string): Promise<{ migrated: boolean; newId?: string }> {
    if (!resumeStore.hasUnsavedLocalDraft) return { migrated: true };

    try {
      const result = await apiFetch<{ id: string }>('/api/resumes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          title: resumeStore.title,
          templateId: resumeStore.templateId,
          content: resumeStore.content,
          themeConfig: resumeStore.themeConfig
        }
      });
      if (!result.ok || !result.data?.id) {
        return { migrated: false };
      }

      const newId = result.data.id;
      const oldId = resumeStore.id;

      resumeStore.loadResumeData({
        id: newId,
        title: resumeStore.title,
        templateId: resumeStore.templateId,
        content: resumeStore.content,
        themeConfig: resumeStore.themeConfig
      });
      // 写新 key、清旧 key，避免旧草稿下次覆盖云端内容
      resumeStore.persistLocalDraft();
      if (oldId !== newId) {
        try {
          localStorage.removeItem(`open_resume_draft:${oldId}`);
          if (oldId === 'local-draft') localStorage.removeItem('open_resume_draft');
        } catch {
          /* localStorage 不可用时忽略 */
        }
      }

      return { migrated: true, newId };
    } catch (err) {
      console.error('迁移本地草稿失败:', err);
      return { migrated: false };
    }
  }

  async function submit(): Promise<SubmitResult> {
    errorMsg.value = '';
    const validationError = validate();
    if (validationError) {
      errorMsg.value = validationError;
      return { ok: false, migrated: false, error: validationError };
    }

    loading.value = true;
    const isLogin = options.mode() === 'login';
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { email: email.value, password: password.value }
      : { email: email.value, password: password.value, nickname: nickname.value };

    try {
      const result = await apiFetch<{ token: string; user: { id: string; email: string; nickname: string } }>(
        endpoint,
        { method: 'POST', body: payload, auth: false }
      );
      if (!result.ok || !result.data) {
        throw new Error(result.message || '操作失败，请重试');
      }

      authStore.setAuth(result.data.token, result.data.user);

      // 先问再迁：静默迁移会让用户莫名其妙多出一份云端简历
      const draftChoice = await askDraftChoice();
      const { migrated, newId } =
        draftChoice === 'sync'
          ? await migrateLocalDraft(result.data.token)
          : { migrated: false, newId: undefined };

      // 迁移成功且用户正在编辑器里：URL 必须同步，否则刷新会回到旧草稿
      if (migrated && newId && route.name === 'Editor') {
        await router.replace({ name: 'Editor', params: { id: newId } });
      }

      trackEvent(isLogin ? 'auth.login.ok' : 'auth.register.ok');
      const submitResult: SubmitResult = { ok: true, migrated, draftChoice };
      options.onSuccess?.(submitResult);
      return submitResult;
    } catch (err: any) {
      errorMsg.value = err.message || '网络连接异常，请重试';
      return { ok: false, migrated: false, error: errorMsg.value };
    } finally {
      loading.value = false;
    }
  }

  return {
    email,
    password,
    nickname,
    showPassword,
    loading,
    errorMsg,
    emailTouched,
    isEmailValid,
    passwordStrength,
    submit
  };
}
