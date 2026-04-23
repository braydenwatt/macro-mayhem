/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        economy: {
          growth: '#22c55e',
          recession: '#eab308',
          depression: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
