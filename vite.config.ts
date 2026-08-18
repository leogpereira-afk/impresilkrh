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
    /* Fuso FIXO na suíte. O app serve uma empresa em Montes Claros, e boa parte
       dos testes trata de data — inclusive com valores reais do banco, que foram
       gravados em UTC-3. Sem fixar, o mesmo teste passa na máquina de quem
       escreveu e reprova na CI, que roda em UTC: foi exatamente o que aconteceu
       e deixou a CI vermelha por três commits. Fixando, o teste quer dizer a
       mesma coisa em qualquer máquina. */
    env: { TZ: "America/Sao_Paulo" },
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
        /* NÃO agrupe o recharts à mão aqui.
           Havia `charts: ["recharts"]` nesta lista, e o efeito era o contrário
           do pretendido: um chunk manual entra no grafo estático da entrada, e
           o Vite emite `<link rel="modulepreload">` para ele no index.html. Ou
           seja, TODO mundo baixava 106 kB de biblioteca de gráfico já na tela
           de LOGIN, que não tem gráfico nenhum — 35% de tudo que a primeira
           tela pedia.
           Sem a linha, o Rollup continua criando um chunk só para o recharts
           (compartilhado entre as telas que usam), mas ele passa a ser carregado
           sob demanda, quando abre uma tela com gráfico. Medido na rede: a
           primeira tela caiu de 303 kB para 197 kB.
           O `react` fica: esse é usado desde o primeiro desenho, e agrupá-lo
           deixa o cache do navegador aproveitá-lo entre publicações. */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
