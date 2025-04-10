/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f5fad',
          light: '#dac4ea',
          dark: '#7826b5'
        },
        secondary: {
          DEFAULT: '#edf1f4',
          light: '#ffffff',
          dark: '#bdc6cc'
        },
        text: {
          DEFAULT: '#6d6870',
          light: '#edf1f4',
          dark: '#4f5fad'
        },
        success: {
          DEFAULT: '#afcf75',
          dark: '#2a5a03'
        },
        danger: {
          DEFAULT: '#ff6b69',
          dark: '#cc0000'
        },
        info: {
          DEFAULT: '#4a89ce'
        }
      }
    },
  },
  plugins: [],
}