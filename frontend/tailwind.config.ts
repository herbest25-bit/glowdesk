import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        base:    '#09090f',
        surface: {
          DEFAULT: '#111118',
          2: '#16161f',
          3: '#1c1c27',
        },
        brand: {
          50:  '#f5f0ff',
          100: '#ede0ff',
          200: '#d9bfff',
          300: '#be93fc',
          400: '#a065f7',
          500: '#7c3aed',
          600: '#6b21a8',
          700: '#581c87',
          800: '#3b0764',
          900: '#1e0340',
        },
        glow: {
          rose:   '#f43f5e',
          gold:   '#f59e0b',
          violet: '#7c3aed',
          grape:  '#6b21a8',
          blue:   '#3b82f6',
          green:  '#10b981',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6b21a8 0%, #7c3aed 50%, #f43f5e 100%)',
        'brand-subtle':   'linear-gradient(135deg, rgba(107,33,168,0.15) 0%, rgba(124,58,237,0.08) 100%)',
        'glow-card':      'linear-gradient(135deg, rgba(107,33,168,0.12) 0%, rgba(244,63,94,0.06) 100%)',
        'dark-grid':      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 0h1v40H0zM0 0h40v1H0z' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E\")",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(124,58,237,0.3)',
        'glow-md': '0 0 24px rgba(124,58,237,0.4)',
        'glow-lg': '0 0 48px rgba(124,58,237,0.35)',
        'dark-sm': '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'dark-md': '0 4px 16px rgba(0,0,0,0.5)',
        'dark-lg': '0 8px 40px rgba(0,0,0,0.6)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      borderColor: {
        subtle:  'rgba(255,255,255,0.06)',
        default: 'rgba(255,255,255,0.10)',
        strong:  'rgba(255,255,255,0.16)',
      },
    }
  },
  plugins: []
}

export default config
