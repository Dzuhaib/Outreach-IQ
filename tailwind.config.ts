import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-2': '#1a1a1a',
        'surface-3': '#222222',
        border: '#252525',
        'border-2': '#333333',
        'text-1': '#f0f0f0',
        'text-2': '#888888',
        'text-3': '#555555',
        accent: '#4f6ef7',
        'accent-hover': '#6379f8',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'nav-pop': {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(0.78)' },
          '65%':  { transform: 'scale(1.18)' },
          '82%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
        'indicator-in': {
          from: { opacity: '0', transform: 'scaleX(0.2)' },
          to:   { opacity: '1', transform: 'scaleX(1)' },
        },
        'pill-in': {
          from: { opacity: '0', transform: 'scale(0.5)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in':      'fade-in 0.2s ease-out',
        'slide-in':     'slide-in 0.2s ease-out',
        'nav-pop':      'nav-pop 0.42s cubic-bezier(0.34,1.56,0.64,1) both',
        'indicator-in': 'indicator-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
        'pill-in':      'pill-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
}

export default config
