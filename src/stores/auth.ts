import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface User {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('open_resume_token'));
  const user = ref<User | null>(
    localStorage.getItem('open_resume_user')
      ? JSON.parse(localStorage.getItem('open_resume_user')!)
      : null
  );

  const isLoggedIn = computed(() => !!token.value);

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('open_resume_token', newToken);
    localStorage.setItem('open_resume_user', JSON.stringify(newUser));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('open_resume_token');
    localStorage.removeItem('open_resume_user');
  }

  return {
    token,
    user,
    isLoggedIn,
    setAuth,
    logout
  };
});
