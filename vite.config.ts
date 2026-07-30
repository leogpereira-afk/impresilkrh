import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// SPA estática — publicável no GitHub Pages. A nuvem (dados + login) é o
// Supabase: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (lidas via
// import.meta.env) definem se o build sai com sincronização ligada. Sem elas,
// o app funciona 100% local.
export default defineConfig({
  plugins: [react()],
  // Caminho onde o build é servido. Padrão: a URL de projeto do GitHub Pages
  // deste repo (https://<usuario>.github.io/impresilkrh/). Quando este app for
  // remontado no futuro "hub" (impresilk.com.br/rh), o hub builda com
  // BASE_PATH=/rh/ — sem mudar código.
  base: process.env.BASE_PATH || "/impresilkrh/",
  // Testes (vitest). `jsdom` porque parte do código toca window/localStorage.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
