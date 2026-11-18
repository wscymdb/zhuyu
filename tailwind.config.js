/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', 'STSong', 'SimSun', 'serif'],
      },
      colors: {
        bamboo: {
          50: '#f2f8f4',
          100: '#e1efe6',
          200: '#c5dfd0',
          300: '#9cc6b0',
          400: '#6ea68b',
          500: '#4d896f',
          600: '#3a6f58',
          700: '#305847',
          800: '#28473a',
          900: '#233b31',
          950: '#11211b',
        }
      }
    },
  },
  plugins: [],
}
