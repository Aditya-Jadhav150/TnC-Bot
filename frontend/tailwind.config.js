/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#4f73ff',
          600: '#2b4eff',
          700: '#1a3beb',
          800: '#142ec4',
          900: '#11239c',
          950: '#0a125c',
        }
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'soft-md': '0 8px 16px -2px rgba(0, 0, 0, 0.06), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}
