import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F1F4F9',
          100: '#E2EAF4',
          200: '#C6D5E9',
          300: '#9DB4D6',
          400: '#6B8ABE',
          500: '#4A6B9F',
          600: '#2F4B7C',
          700: '#26405F',
          800: '#1E3149',
          900: '#162435',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
      boxShadow: {
        1: '0 1px 2px rgba(16, 24, 40, 0.05)',
        2: '0 4px 8px -2px rgba(16, 24, 40, 0.08)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config