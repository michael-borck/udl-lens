import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
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
    },
  },
  plugins: [],
}

export default config
