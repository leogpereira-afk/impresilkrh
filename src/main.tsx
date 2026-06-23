import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
// Sincronização offline-first: registra o gancho de mutações do store e os
// ouvintes de online/offline. É opt-in — sem token configurado, nada é enviado.
import "@/lib/sync";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// PWA: registra o Service Worker (abre rápido, funciona offline). Só em produção
// com HTTPS/localhost; falhas são silenciosas (o app funciona sem ele).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
