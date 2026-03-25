/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0F0F0F',
        surface: '#1C1C1E',
        elevated: '#2C2C2E',
        gold: '#C8922A',
        rust: '#8B4513',
        'text-primary': '#F2EDE4',
        'text-secondary': '#A8A29E',
        'text-muted': '#6B7280',
      },
      fontFamily: {
        devanagari: ['"Noto Serif Devanagari"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
