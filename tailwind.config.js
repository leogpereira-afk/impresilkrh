/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#0f2238",
          DEFAULT: "#16334f",
          dark: "#11283e",
          light: "#1f4a66",
          50: "#f0f5f9",
          100: "#dbe6f0",
          600: "#16334f",
          700: "#11283e",
        },
        gold: {
          DEFAULT: "#c2a14d",
          50: "#faf6ec",
          100: "#f3ead0",
          200: "#e7d3a1",
          300: "#d9bb72",
          600: "#a8873a",
          700: "#8a6e30",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(15,34,54,0.06), 0 1px 2px rgba(15,34,54,0.04)",
        card: "0 4px 16px -4px rgba(15,34,54,0.10)",
      },
    },
  },
  plugins: [],
};
