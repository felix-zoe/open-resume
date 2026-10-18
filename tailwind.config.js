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
      boxShadow: {
        '2xs': '0 1px 1px rgba(15, 23, 42, 0.04)',
        xs: '0 1px 2px rgba(15, 23, 42, 0.06)'
      },
      borderRadius: {
        xs: '2px'
      },
      backdropBlur: {
        '2xs': '2px'
      },
      spacing: {
        '4.5': '1.125rem'
      }
    },
  },
  plugins: [],
}
