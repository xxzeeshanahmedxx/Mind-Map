/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
      },
      boxShadow: {
        node: '0 14px 35px rgba(15, 23, 42, 0.22)'
      }
    },
  },
  plugins: [],
}
