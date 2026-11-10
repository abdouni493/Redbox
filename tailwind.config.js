/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm bakery backgrounds
        cream: '#FDF8F0',
        vanilla: '#F5EDE0',
        // Golden wheat = primary accent (token name "gold" kept for compatibility)
        gold: {
          DEFAULT: '#C8892E',
          light: '#E8C87A',
          dark: '#9B6A1F',
        },
        // Warm terracotta (rose.deep = danger / debt signal)
        rose: {
          DEFAULT: '#D4856A',
          deep: '#C0392B',
        },
        // Deep blue-slate for variety accents
        lavender: {
          DEFAULT: '#6B7FA3',
          deep: '#4A5D80',
        },
        // Rich espresso — used for high-contrast text & overlays
        chocolate: '#3E2723',
        // Warm amber (warning)
        caramel: '#E67E22',
        // Forest sage (success)
        pistachio: '#27AE60',
        text: {
          primary: '#2C1810',
          secondary: '#5D4037',
          muted: '#8D6E63',
          light: '#FDF8F0',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #3E2723 0%, #5D4037 28%, #4E342E 62%, #6D4C41 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #3E2723 0%, #4E342E 48%, #5D4037 100%)',
        'gradient-card': 'linear-gradient(145deg, #FFFFFF 0%, #FDF8F0 100%)',
        'gradient-button': 'linear-gradient(135deg, #D4A04A 0%, #C8892E 50%, #9B6A1F 100%)',
        'gradient-rose': 'linear-gradient(135deg, #E8A090 0%, #D4856A 50%, #C0392B 100%)',
        'gradient-lavender': 'linear-gradient(135deg, #8FA3C4 0%, #6B7FA3 50%, #4A5D80 100%)',
        'gradient-mint': 'linear-gradient(135deg, #7DCEA0 0%, #27AE60 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(253,248,240,0.92) 0%, rgba(245,237,224,0.75) 100%)',
      },
      boxShadow: {
        card: '0 4px 24px rgba(62, 39, 35, 0.08), 0 1px 4px rgba(62, 39, 35, 0.04)',
        hover: '0 10px 34px rgba(62, 39, 35, 0.14), 0 2px 8px rgba(62, 39, 35, 0.08)',
        gold: '0 6px 22px rgba(200, 137, 46, 0.35)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
