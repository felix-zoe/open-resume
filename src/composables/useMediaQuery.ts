import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * 响应式断点订阅。
 *
 * 只用于“结构不同”的场景（例如移动端把左右分栏换成 Tab）。
 * 纯视觉差异仍用 Tailwind 的 `lg:` 前缀，避免 JS 与 CSS 两套断点打架。
 */
export function useMediaQuery(query: string) {
  const matches = ref(false);
  let mql: MediaQueryList | null = null;
  const update = (event: MediaQueryList | MediaQueryListEvent) => {
    matches.value = event.matches;
  };

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    mql = window.matchMedia(query);
    update(mql);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
    } else {
      // Safari < 14
      mql.addListener(update);
    }
  });

  onBeforeUnmount(() => {
    if (!mql) return;
    if (typeof mql.removeEventListener === 'function') {
      mql.removeEventListener('change', update);
    } else {
      mql.removeListener(update);
    }
    mql = null;
  });

  return matches;
}
