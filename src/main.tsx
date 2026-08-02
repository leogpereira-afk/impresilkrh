import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { aplicarTema, temaInicial } from "@/lib/tema";
// Aplica o tema salvo (ou o do sistema) antes de renderizar, evitando "flash".
aplicarTema(temaInicial());
// Sincronização offline-first: registra o gancho de mutações do store e os
// ouvintes de online/offline. É opt-in — sem token configurado, nada é enviado.
import "@/lib/sync";
// Migrações de dados locais (ex.: plano de contas antigo sem id) — rodam antes
// do primeiro render e empurram o que foi corrigido para a nuvem.
import { rodarMigracoes } from "@/lib/migracoes";
rodarMigracoes();
// Histórico de alterações: liga o store ao módulo de auditoria. Fica AQUI, e não
// dentro do store, porque o store não pode importar quem o escuta (viraria
// ciclo). Depois das migrações de propósito — o que o app conserta sozinho no
// boot não é "alguém mexeu".
import { ligarHistorico } from "@/lib/historico";
ligarHistorico();

// basename = o caminho onde o app é servido (BASE_URL vem do `base` do Vite:
// "/impresilkrh/" no GitHub Pages, "/" num domínio próprio). Sem isto, o React
// Router usa caminhos da RAIZ e um refresh numa subpágina do GitHub Pages cai
// fora do app (tela branca/404). Tira a barra final que o React Router não quer.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={BASENAME}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// PWA: registra o Service Worker (abre rápido, funciona offline). Só em produção
// com HTTPS/localhost; falhas são silenciosas (o app funciona sem ele). O SW mora
// no MESMO caminho do app (BASE_URL) — no GitHub Pages é /impresilkrh/sw.js.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
