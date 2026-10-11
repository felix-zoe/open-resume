import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import EditorView from '../views/EditorView.vue';
import DashboardView from '../views/DashboardView.vue';
import ShareView from '../views/ShareView.vue';
import LoginView from '../views/LoginView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomeView
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView
  },
  {
    path: '/register',
    name: 'Register',
    component: LoginView
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: EditorView
  },
  {
    path: '/share/:id',
    name: 'Share',
    component: ShareView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 全局路由导航守卫：未登录拦截受保护路由
router.beforeEach((to, _, next) => {
  const token = localStorage.getItem('open_resume_token');
  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

export default router;
