<script setup lang="ts">
import { useResumeStore } from '../../stores/resume';
import { User, Mail, Phone, MapPin, Globe, Github, Image as ImageIcon } from 'lucide-vue-next';

const resumeStore = useResumeStore();
const profile = resumeStore.content.profile;

// 简易本地图片选择并转 Base64 预览（MVP 快速体验，后续可接 R2 上传）
const handleAvatarFile = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小请小于 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      profile.avatar = uploadEvent.target?.result as string;
      profile.showAvatar = true;
    };
    reader.readAsDataURL(file);
  }
};
</script>

<template>
  <div class="space-y-4">
    <!-- 头像与核心信息栏 -->
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <label class="block text-xs font-medium text-gray-500 mb-1">求职照片</label>
        <div class="relative group cursor-pointer w-20 h-24 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition">
          <img v-if="profile.avatar" :src="profile.avatar" class="w-full h-full object-cover" />
          <div v-else class="text-center p-1 text-gray-400">
            <ImageIcon class="w-5 h-5 mx-auto mb-1" />
            <span class="text-[10px]">点击上传</span>
          </div>
          <input type="file" accept="image/*" @change="handleAvatarFile" class="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        <div class="mt-1 flex items-center gap-1">
          <input type="checkbox" id="showAvatar" v-model="profile.showAvatar" class="w-3.5 h-3.5 rounded text-blue-600" />
          <label for="showAvatar" class="text-[11px] text-gray-500 cursor-pointer">显示头像</label>
        </div>
      </div>

      <!-- 姓名与职位 -->
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">真实姓名 *</label>
          <div class="relative">
            <User class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              v-model="profile.name"
              placeholder="如：张小凡"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">求职意向 / 目标岗位 *</label>
          <input
            type="text"
            v-model="profile.title"
            placeholder="如：资深前端工程师"
            class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">联系电话 *</label>
          <div class="relative">
            <Phone class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              v-model="profile.phone"
              placeholder="如：13800138000"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">电子邮箱 *</label>
          <div class="relative">
            <Mail class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="email"
              v-model="profile.email"
              placeholder="如：xiaofan@example.com"
              class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 城市与年限薪资 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">所在城市</label>
        <div class="relative">
          <MapPin class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            v-model="profile.location"
            placeholder="如：北京·海淀"
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">工作年限</label>
        <input
          type="text"
          v-model="profile.workYears"
          placeholder="如：3年经验 / 应届生"
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">期望薪资 (选填)</label>
        <input
          type="text"
          v-model="profile.salaryExpectation"
          placeholder="如：20k-25k"
          class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        />
      </div>
    </div>

    <!-- 社交链接 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">GitHub 主页</label>
        <div class="relative">
          <Github class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            v-model="profile.github"
            placeholder="https://github.com/..."
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">个人主页 / 作品集</label>
        <div class="relative">
          <Globe class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            v-model="profile.website"
            placeholder="https://yourblog.com"
            class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          />
        </div>
      </div>
    </div>

    <!-- 个人总结 / 亮点 -->
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">个人总结 / 核心亮点</label>
      <textarea
        v-model="profile.summary"
        rows="2"
        placeholder="简明扼要概括工作年限、擅长核心技术栈与代表性成果..."
        class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
      ></textarea>
    </div>
  </div>
</template>
