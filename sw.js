/* ===========================================================================
 * Service Worker — Impresilk RH (PWA, estratégia "network-first").
 *
 * Objetivos:
 *  - App abre rápido e funciona offline (cache do "casco" + dos assets já vistos).
 *  - SEMPRE buscar a versão mais nova quando houver rede (evita ver dados velhos).
 *  - NUNCA cachear as chamadas da nuvem (Supabase): já ficam de fora porque são
 *    POST (regra 1) e de outra origem, *.supabase.co (regra 3).
 *
 * Versão do cache: troque CACHE a cada deploy que mude assets do casco para
 * forçar a limpeza do cache antigo. (Assets do Vite têm hash no nome, então o
 * essencial é versionar o casco/HTML.)
 * ======================================================================== */
const CACHE = "impresilk-rh-v9";

// Caminho onde o app é servido = a pasta do próprio SW ("/impresilkrh/" no
// GitHub Pages, "/" num domínio próprio). Tudo abaixo é relativo a isto — senão
// no GitHub Pages o SW cacheava "/" (a raiz do github.io, fora do app).
const BASE = new URL("./", self.location).pathname;

// "Casco" do app: o mínimo para abrir a interface mesmo offline.
const CASCO = [BASE, BASE + "index.html", BASE + "favicon.png", BASE + "apple-touch-icon.png"];

// ----- instalação: pré-carrega o casco -----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CASCO)).catch(() => {}),
  );
  // Ativa esta versão imediatamente, sem esperar abas antigas fecharem.
  self.skipWaiting();
});

/* ----- ativação: remove caches de versões anteriores DESTE sistema -----
 *
 * `caches` é por ORIGEM, não por escopo: o RH, o Painel (painel-v1) e o POPs
 * (pops-shell-v11) moram todos em leogpereira-afk.github.io. Apagando "tudo o
 * que não é o meu", cada visita ao RH zerava o disco dos outros dois -- e os
 * três faziam a mesma coisa, um contra o outro, então o ganho de velocidade de
 * cada um evaporava ao trocar de sistema. O prefixo separa a MINHA prateleira
 * velha da casa alheia. (Achado na conferência do Painel, 24/08/2026.)
 */
const MEU_PREFIXO = "impresilk-rh-";
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((k) => k !== CACHE && k.startsWith(MEU_PREFIXO))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ----- requisições -----
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Só tratamos GET. POST/PUT (inclusive a sincronização) passa direto.
  if (req.method !== "GET") return;

  // 2) Só cuidamos do nosso próprio domínio (deixa Supabase, fontes/CDN externos à parte).
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  // 3) Network-first: tenta a rede; em sucesso, atualiza o cache; em falha
  //    (offline), entrega do cache. Para navegação (HTML), o fallback é o casco.
  //    Navegação (HTML) busca SEMPRE fresco (cache: "no-store"), ignorando o cache
  //    HTTP do browser — assim todo deploy novo chega no F5, sem hard-refresh.
  const reqRede = req.mode === "navigate" ? new Request(req.url, { cache: "no-store", credentials: "same-origin" }) : req;
  event.respondWith(
    fetch(reqRede)
      .then((resp) => {
        // Guarda uma cópia das respostas boas para uso offline futuro.
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        const cacheado = await cache.match(req);
        if (cacheado) return cacheado;
        if (req.mode === "navigate") {
          const casco = await cache.match(BASE + "index.html");
          if (casco) return casco;
        }
        return Response.error();
      }),
  );
});
