import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// SPA estática — sem servidor, sem banco. Publicável no Netlify (drag-and-drop ou Git).
export default defineConfig({
  plugins: [react()],
  // Sincronização automática: o token definido no Netlify (variável SYNC_TOKEN)
  // é embutido no app no momento do build. Assim NÃO há senha para digitar — todo
  // computador que abre o app já sincroniza sozinho. Se SYNC_TOKEN não existir, o
  // valor fica vazio e a sincronização permanece desligada (app 100% local).
  //
  // __AUTH_JWT__: liga o LOGIN REAL (verificado no servidor). Embute apenas um
  // booleano — NUNCA o segredo (JWT_SECRET fica só no servidor). Quando true, o
  // app autentica pela função /auth e usa o crachá (JWT) para falar com a nuvem.
  define: {
    __SYNC_TOKEN__: JSON.stringify(process.env.SYNC_TOKEN ?? ""),
    __AUTH_JWT__: JSON.stringify(Boolean(process.env.JWT_SECRET)),
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
