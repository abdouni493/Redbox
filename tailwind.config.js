/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Clean warm fast-food backgrounds
        cream: '#FFF8F3',
        vanilla: '#FFEEE2',
        // Hot appetizing orange = primary accent (token name "gold" kept for compatibility)
        gold: {
          DEFAULT: '#FF6B2C',
          light: '#FFA76B',
          dark: '#E24E0E',
        },
        // Fast-food red (rose.deep = danger / debt signal)
        rose: {
          DEFAULT: '#EF4444',
          deep: '#C1121F',
        },
        // Fresh teal for variety accents
        lavender: {
          DEFAULT: '#0EA5A4',
          deep: '#0C7E7D',
        },
        // Deep charcoal — used for high-contrast text, sidebar & overlays
        chocolate: '#1A120B',
        // Warm amber (warning)
        caramel: '#F59E0B',
        // Fresh green (success)
        pistachio: '#16A34A',
        // Punchy yellow pop (fast-food secondary)
        sun: '#FFC43D',
        text: {
          primary: '#1F1206',
          secondary: '#5C4632',
          muted: '#9A8574',
          light: '#FFF8F3',
        },
      },
      fontFamily: {
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #C1121F 0%, #E63946 32%, #FF6B2C 72%, #FF8A3D 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #1A120B 0%, #2A1C10 52%, #231708 100%)',
        'gradient-card': 'linear-gradient(145deg, #FFFFFF 0%, #FFF8F3 100%)',
        'gradient-button': 'linear-gradient(135deg, #FF8A3D 0%, #FF6B2C 50%, #E24E0E 100%)',
        'gradient-rose': 'linear-gradient(135deg, #FF7A7A 0%, #EF4444 50%, #C1121F 100%)',
        'gradient-lavender': 'linear-gradient(135deg, #2DD4BF 0%, #0EA5A4 50%, #0C7E7D 100%)',
        'gradient-mint': 'linear-gradient(135deg, #4ADE80 0%, #16A34A 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,248,243,0.92) 0%, rgba(255,238,226,0.75) 100%)',
      },
      boxShadow: {
        card: '0 4px 24px rgba(26, 18, 11, 0.08), 0 1px 4px rgba(26, 18, 11, 0.04)',
        hover: '0 10px 34px rgba(226, 78, 14, 0.18), 0 2px 8px rgba(26, 18, 11, 0.08)',
        gold: '0 8px 24px rgba(255, 107, 44, 0.42)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.1rem',
      },
    },
  },
  plugins: [],
};
