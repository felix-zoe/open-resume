/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 产品主色（chrome 层唯一允许的品牌色）
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309'
        },
        danger: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c'
        }
      },
      // 仅增量补齐代码中已在使用的 token，不重定义默认刻度
      fontSize: {
        // 11px：界面元信息的最小字号（替代散落的 text-[10px]/text-[11px]）
        '2xs': ['11px', '16px']
      },
      // 阴影四档，全部使用低透明度 slate（见方案 1.3.1）
      boxShadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
        sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        md: '0 4px 12px rgba(15, 23, 42, 0.08)',
        lg: '0 12px 32px rgba(15, 23, 42, 0.12)'
      },
      // 圆角刻度显式声明，取值与 Tailwind 默认一致：
      // 方案 1.3.1 的 xs–2xl 是整体上移一档的写法，直接套用会把全站圆角放大 4px，
      // 因此保留现有视觉，只把刻度固定下来避免依赖默认值。
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px'
      }
    },
  },
  plugins: [],
}
