/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // "Aurora" — deep navy surfaces with a violet → sky brand accent
        surface: {
          DEFAULT: '#0a0f1e', // deep navy page background
          card: '#141b30',    // card background
          raised: '#1e2740',  // slightly raised panels
          border: '#2b3656',  // borders
        },
        brand: {
          DEFAULT: '#8b5cf6', // violet-500
          dark: '#7c3aed',    // violet-600
          soft: '#a78bfa',    // violet-400
        },
        accent: {
          DEFAULT: '#38bdf8', // sky-400 — secondary accent
          soft: '#7dd3fc',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.45), 0 1px 2px -1px rgba(0,0,0,0.45)',
        raised: '0 10px 30px -10px rgba(0,0,0,0.65)',
        glow: '0 0 0 1px rgba(139,92,246,0.35), 0 8px 30px -8px rgba(139,92,246,0.5)',
        'glow-lg': '0 0 44px -8px rgba(139,92,246,0.6)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #a78bfa 0%, #818cf8 45%, #38bdf8 100%)',
        'grid-faint':
          'linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'spin-reverse': { to: { transform: 'rotate(-360deg)' } },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(0.9)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin-slow 1.6s linear infinite',
        'spin-reverse': 'spin-reverse 2.2s linear infinite',
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
