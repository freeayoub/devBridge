/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#7826b5',
          dark: '#9747FF'
        },
        secondary: {
          light: '#4f5fad',
          dark: '#6373c3'
        },
        background: {
          light: '#edf1f4',
          dark: '#1a1a2e'
        },
        card: {
          light: '#ffffff',
          dark: '#2d3748'
        },
        text: {
          light: '#333333',
          dark: '#f7fafc'
        }
      }
    },
  },
  plugins: [],
}
