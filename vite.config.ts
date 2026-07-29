import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// SPA estática — publicável no GitHub Pages. A nuvem (dados + login) é o
// Supabase: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (lidas automaticamente
// pelo Vite via import.meta.env) definem se o build sai com sincronização
// ligada. Sem elas, o app funciona 100% local.
export default defineConfig({
  plugins: [react()],
  // Caminho onde o build é servido. Padrão: a URL de projeto do GitHub Pages
  // deste repo (https://<usuario>.github.io/impresilkrh/). Quando este app for
  // remontado dentro do futuro "hub" (impresilk.com.br/rh), o build do hub passa
  // BASE_PATH=/rh/ nesta mesma etapa — sem precisar mudar código.
  base: process.env.BASE_PATH || "/impresilkrh/",
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
