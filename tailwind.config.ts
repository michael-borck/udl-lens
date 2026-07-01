import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        teal: {
          DEFAULT: '#1B3A4B',
          light: '#2E5569',
          dark: '#0F2530',
        },
        terracotta: {
          DEFAULT: '#C96B2F',
          light: '#E08050',
          dark: '#A5551F',
        },
        amber: '#D4A017',
        sand: '#E8E0D0',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'mock-rise': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'radar-draw': {
          from: { opacity: '0', transform: 'scale(0.2)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'hero-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,107,47,0.5)' },
          '70%': { boxShadow: '0 0 0 7px rgba(201,107,47,0)' },
        },
      },
      animation: {
        'mock-rise': 'mock-rise 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both',
        'radar-draw': 'radar-draw 1.1s cubic-bezier(0.16,1,0.3,1) both',
        blink: 'blink 1.3s infinite',
        'hero-pulse': 'hero-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
