import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { aplicarTema, temaInicial } from "@/lib/tema";
// Aplica o tema salvo (ou o do sistema) antes de renderizar, evitando "flash".
aplicarTema(temaInicial());
// As coleções moram no IndexedDB (a cota do localStorage é de 5 MB e TODOS os
// sistemas da casa dividem a mesma origem). Ler disco é assíncrono, então o
// boot inteiro espera: pintar antes disso mostraria o app VAZIO por um
// instante, e quem estivesse editando poderia gravar por cima do nada.
import { prontoArmazem } from "@/lib/armazemLocal";
// Sincronização offline-first: registra o gancho de mutações do store e os
// ouvintes de online/offline. É opt-in — sem token configurado, nada é enviado.
import "@/lib/sync";
// Migrações de dados locais (ex.: plano de contas antigo sem id) — rodam antes
// do primeiro render e empurram o que foi corrigido para a nuvem.
import { rodarMigracoes } from "@/lib/migracoes";
// Histórico de alterações: liga o store ao módulo de auditoria. Fica AQUI, e não
// dentro do store, porque o store não pode importar quem o escuta (viraria
// ciclo). Depois das migrações de propósito — o que o app conserta sozinho no
// boot não é "alguém mexeu".
import { ligarHistorico } from "@/lib/historico";

// basename = o caminho onde o app é servido (BASE_URL vem do `base` do Vite:
// "/impresilkrh/" no GitHub Pages, "/" num domínio próprio). Sem isto, o React
// Router usa caminhos da RAIZ e um refresh numa subpágina do GitHub Pages cai
// fora do app (tela branca/404). Tira a barra final que o React Router não quer.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

function iniciar() {
  // Ordem importa: migrações leem e escrevem coleções, então só depois que o
  // armazém está na mão. O histórico entra em seguida — o que o app conserta
  // sozinho no boot não é "alguém mexeu".
  rodarMigracoes();
  ligarHistorico();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter basename={BASENAME}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

// Se o disco falhar, o armazém já cai sozinho no localStorage: o app abre do
// mesmo jeito, com a cota antiga, em vez de ficar numa tela branca.
prontoArmazem().catch(() => {}).then(iniciar);

// PWA: registra o Service Worker (abre rápido, funciona offline). Só em produção
// com HTTPS/localhost; falhas são silenciosas (o app funciona sem ele). O SW mora
// no MESMO caminho do app (BASE_URL) — no GitHub Pages é /impresilkrh/sw.js.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
