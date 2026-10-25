<script setup lang="ts">
import { ref, computed } from 'vue';
import { useResumeStore } from '../../stores/resume';
import { useAuthStore } from '../../stores/auth';
import { apiFetch } from '../../utils/http';
import { processAvatar, validateAvatarFile } from '../../utils/image';
import { validateEmail, validatePhone, validateUrl } from '../../utils/validation';
import { useToast } from '../../composables/useToast';
import { User, Mail, Phone, MapPin, Globe, Github, Image as ImageIcon, Loader2, Trash2 } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const authStore = useAuthStore();
// 使用计算属性时刻绑定 store 最新内容，彻底解决对象替换后的响应式断链
const profile = computed(() => resumeStore.content.profile);

const isUploading = ref(false);
const toast = useToast();

/**
 * 字段校验状态。
 *
 * 只在「失焦后」或「已有错误且用户继续输入」时展示，避免用户刚敲第一个
 * 数字就看到红字。空值不报错——必填提示留给导出前的内容体检。
 */
const touched = ref<Record<string, boolean>>({});

function markTouched(field: string) {
  touched.value = { ...touched.value, [field]: true };
}

const phoneError = computed(() => {
  if (!touched.value.phone || !profile.value.phone) return '';
  const result = validatePhone(profile.value.phone);
  return result.valid ? '' : result.message;
});

const emailError = computed(() => {
  if (!touched.value.email || !profile.value.email) return '';
  const result = validateEmail(profile.value.email);
  return result.valid ? '' : result.message;
});

const githubError = computed(() => {
  if (!touched.value.github || !profile.value.github) return '';
  const result = validateUrl(profile.value.github);
  return result.valid ? '' : result.message;
});

const websiteError = computed(() => {
  if (!touched.value.website || !profile.value.website) return '';
  const result = validateUrl(profile.value.website);
  return result.valid ? '' : result.message;
});

/**
 * 头像上传。
 *
 * 无论是否登录，都先在本地裁剪压缩成 300×300、≤80KB 的 WebP，
 * 再把压缩后的结果上传到 R2——直接传原图既浪费流量，也会让游客草稿
 * 的 base64 撑爆存储配额。
 */
const handleAvatarFile = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const validation = await validateAvatarFile(file);
  if (!validation.ok) {
    toast.error(validation.message);
    target.value = '';
    return;
  }

  isUploading.value = true;
  try {
    const processed = await processAvatar(file);

    // 先落到本地，保证即使上传失败用户也能看到照片
    profile.value.avatar = processed.dataUrl;
    profile.value.showAvatar = true;

    if (authStore.isLoggedIn && authStore.token) {
      // 把 data URL 转回 Blob 再上传，避免把 base64 文本当文件传
      const blob = await (await fetch(processed.dataUrl)).blob();
      const formData = new FormData();
      formData.append('file', new File([blob], 'avatar.webp', { type: blob.type }));

      const result = await apiFetch<{ url?: string }>('/api/upload/avatar', {
        method: 'POST',
        body: formData
      });

      if (result.ok && result.data?.url) {
        profile.value.avatar = result.data.url;
      } else {
        toast.error(result.message || '头像已压缩保存到本地，但上传云端失败');
      }
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '头像处理失败，请换一张图片');
  } finally {
    isUploading.value = false;
    target.value = '';
  }
};

/** 移除头像 */
const removeAvatar = () => {
  profile.value.avatar = '';
  profile.value.showAvatar = false;
};
</script>

<template>
  <div class="space-y-4">
    <!-- 头像与核心信息栏 -->
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-slate-500 mb-1">求职照片</label>
        <div class="relative group cursor-pointer w-20 h-24 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition">
          <img v-if="profile.avatar" :src="profile.avatar" alt="已上传的求职照片" class="w-full h-full object-cover" />
          <div v-else class="text-center p-1 text-slate-400">
            <ImageIcon class="w-5 h-5 mx-auto mb-1" />
            <span class="text-2xs">点击上传</span>
          </div>
          <!-- 上传中遮罩 -->
          <div v-if="isUploading" class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white z-10">
            <Loader2 class="w-5 h-5 animate-spin mb-1 text-white" />
            <span class="text-2xs">上传中...</span>
          </div>
          <input
            type="file"
            accept="image/*"
            :disabled="isUploading"
            aria-label="上传求职照片"
            @change="handleAvatarFile"
            class="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
        <div class="mt-1 flex items-center gap-2">
          <input type="checkbox" id="showAvatar" v-model="profile.showAvatar" class="w-3.5 h-3.5 rounded text-primary-600" />
          <label for="showAvatar" class="text-2xs text-slate-500 cursor-pointer">显示头像</label>
          <button
            v-if="profile.avatar"
            type="button"
            class="ml-auto inline-flex items-center gap-0.5 text-2xs text-slate-500 hover:text-danger-600 transition"
            title="移除头像"
            @click="removeAvatar"
          >
            <Trash2 class="w-3 h-3" aria-hidden="true" />
            <span>移除</span>
          </button>
        </div>
      </div>

      <!-- 姓名与职位 -->
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">真实姓名 *</label>
          <div class="relative">
            <User class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              v-model="profile.name"
              placeholder="如：张小凡"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">求职意向 / 目标岗位 *</label>
          <input
            type="text"
            v-model="profile.title"
            placeholder="如：资深前端工程师"
            class="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
          />
        </div>

        <div>
          <label for="profile-phone" class="block text-xs font-medium text-slate-600 mb-1">联系电话 *</label>
          <div class="relative">
            <Phone class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              id="profile-phone"
              type="tel"
              inputmode="tel"
              v-model="profile.phone"
              placeholder="如：13800138000"
              :aria-invalid="!!phoneError || undefined"
              :aria-describedby="phoneError ? 'profile-phone-error' : undefined"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border rounded-lg focus:ring-1 focus:ring-primary-500 outline-none transition"
              :class="phoneError ? 'border-danger-300 focus:border-danger-500' : 'border-slate-200 focus:border-primary-500'"
              @blur="markTouched('phone')"
            />
          </div>
          <p v-if="phoneError" id="profile-phone-error" class="text-2xs font-medium text-danger-600 mt-1" role="alert">
            {{ phoneError }}
          </p>
        </div>

        <div>
          <label for="profile-email" class="block text-xs font-medium text-slate-600 mb-1">电子邮箱 *</label>
          <div class="relative">
            <Mail class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              id="profile-email"
              type="email"
              v-model="profile.email"
              placeholder="如：xiaofan@example.com"
              :aria-invalid="!!emailError || undefined"
              :aria-describedby="emailError ? 'profile-email-error' : undefined"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border rounded-lg focus:ring-1 focus:ring-primary-500 outline-none transition"
              :class="emailError ? 'border-danger-300 focus:border-danger-500' : 'border-slate-200 focus:border-primary-500'"
              @blur="markTouched('email')"
            />
          </div>
          <p v-if="emailError" id="profile-email-error" class="text-2xs font-medium text-danger-600 mt-1" role="alert">
            {{ emailError }}
          </p>
        </div>
      </div>
    </div>

    <!-- 城市与年限薪资 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">所在城市</label>
        <div class="relative">
          <MapPin class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            v-model="profile.location"
            placeholder="如：北京·海淀"
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">工作年限</label>
        <input
          type="text"
          v-model="profile.workYears"
          placeholder="如：3年经验 / 应届生"
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">期望薪资 (选填)</label>
        <input
          type="text"
          v-model="profile.salaryExpectation"
          placeholder="如：20k-25k"
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
        />
      </div>
    </div>

    <!-- 社交链接 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label for="profile-github" class="block text-xs font-medium text-slate-600 mb-1">GitHub 主页</label>
        <div class="relative">
          <Github class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
          <input
            id="profile-github"
            type="text"
            v-model="profile.github"
            placeholder="https://github.com/..."
            :aria-invalid="!!githubError || undefined"
            :aria-describedby="githubError ? 'profile-github-error' : undefined"
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border rounded-lg focus:ring-1 focus:ring-primary-500 outline-none transition"
            :class="githubError ? 'border-danger-300 focus:border-danger-500' : 'border-slate-200 focus:border-primary-500'"
            @blur="markTouched('github')"
          />
        </div>
        <p v-if="githubError" id="profile-github-error" class="text-2xs font-medium text-danger-600 mt-1" role="alert">
          {{ githubError }}
        </p>
      </div>

      <div>
        <label for="profile-website" class="block text-xs font-medium text-slate-600 mb-1">个人主页 / 作品集</label>
        <div class="relative">
          <Globe class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
          <input
            id="profile-website"
            type="text"
            v-model="profile.website"
            placeholder="https://yourblog.com"
            :aria-invalid="!!websiteError || undefined"
            :aria-describedby="websiteError ? 'profile-website-error' : undefined"
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border rounded-lg focus:ring-1 focus:ring-primary-500 outline-none transition"
            :class="websiteError ? 'border-danger-300 focus:border-danger-500' : 'border-slate-200 focus:border-primary-500'"
            @blur="markTouched('website')"
          />
        </div>
        <p v-if="websiteError" id="profile-website-error" class="text-2xs font-medium text-danger-600 mt-1" role="alert">
          {{ websiteError }}
        </p>
      </div>
    </div>

    <!-- 个人总结 / 亮点 -->
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1">个人总结 / 核心亮点</label>
      <textarea
        v-model="profile.summary"
        rows="2"
        placeholder="简明扼要概括工作年限、擅长核心技术栈与代表性成果..."
        class="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
      ></textarea>
    </div>
  </div>
</template>
