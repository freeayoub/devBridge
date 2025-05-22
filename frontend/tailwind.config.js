/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  darkMode: "class", // Activer le mode sombre basé sur la classe
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4f5fad",
          light: "#dac4ea",
          dark: "#7826b5",
        },
        secondary: {
          DEFAULT: "#edf1f4",
          light: "#ffffff",
          dark: "#bdc6cc",
        },
        text: {
          DEFAULT: "#6d6870",
          light: "#edf1f4",
          dark: "#4f5fad",
        },
        success: {
          DEFAULT: "#afcf75",
          dark: "#2a5a03",
        },
        danger: {
          DEFAULT: "#ff6b69",
          dark: "#cc0000",
        },
        info: {
          DEFAULT: "#4a89ce",
        },
        // Couleurs spécifiques au mode sombre
        dark: {
          bg: {
            primary: "#0a0e17",
            secondary: "#111827",
            tertiary: "#1f2937",
          },
          text: {
            primary: "#f9fafb",
            secondary: "#9ca3af",
          },
          accent: {
            primary: "#00f7ff",
            secondary: "#9d4edd",
          },
        },
      },
      animation: {
        "pulse-slow": "pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-slow": "float 15s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "bounce-slow": "bounce 3s infinite",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 247, 255, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 247, 255, 0.8)" },
        },
      },
      gridTemplateRows: {
        12: "repeat(12, minmax(0, 1fr))",
      },
    },
  },
  plugins: [],
};
