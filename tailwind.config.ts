import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pl: {
          dark: '#0B0E17',
          navy: '#121829',
          card: '#1A1F35',
          border: '#2A3050',
          gold: '#E8A624',
          'gold-light': '#F0C050',
          'gold-dark': '#C88B15',
          accent: '#4A6CF7',
          'accent-light': '#6B8AFF',
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#6B7280',
          text: '#E5E7EB',
          'text-dim': '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
