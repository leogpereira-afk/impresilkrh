import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        card: "0 1px 2px 0 rgba(15, 34, 54, 0.04), 0 1px 3px 0 rgba(15, 34, 54, 0.08)",
        "card-hover":
          "0 4px 12px -2px rgba(15, 34, 54, 0.12), 0 2px 6px -2px rgba(15, 34, 54, 0.08)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
