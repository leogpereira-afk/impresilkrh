import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade Impresilk — paleta executiva (navy + dourado)
        brand: {
          ink: "#0f2236", // navy profundo
          DEFAULT: "#16334f", // navy principal
          dark: "#0c1c2e",
          light: "#1f4a66",
          50: "#eef3f8",
          100: "#d6e2ee",
          200: "#aec6dd",
          300: "#7ea4c6",
          400: "#4f7ea8",
          500: "#16334f",
          600: "#13405f",
          700: "#102f47",
          800: "#0c1c2e",
          900: "#08131f",
        },
        gold: {
          DEFAULT: "#c2a14d",
          50: "#faf6ec",
          100: "#f2e9cf",
          200: "#e6d39f",
          300: "#d7bb6e",
          400: "#c2a14d",
          500: "#a9883a",
          600: "#896c2d",
          700: "#6a5223",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Sombras difusas e suaves (estilo Apple)
        card: "0 1px 2px rgba(15, 34, 54, 0.04), 0 6px 20px -8px rgba(15, 34, 54, 0.10)",
        "card-hover":
          "0 2px 4px rgba(15, 34, 54, 0.05), 0 16px 36px -12px rgba(15, 34, 54, 0.18)",
        soft: "0 10px 40px -12px rgba(15, 34, 54, 0.18)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s var(--ease-apple) both",
        "scale-in": "scale-in 0.3s var(--ease-apple) both",
        "slide-up": "slide-up 0.5s var(--ease-apple) both",
      },
    },
  },
  plugins: [],
};

export default config;
