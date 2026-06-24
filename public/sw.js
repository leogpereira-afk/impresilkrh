/* ===========================================================================
 * Service Worker — Impresilk RH (PWA, estratégia "network-first").
 *
 * Objetivos:
 *  - App abre rápido e funciona offline (cache do "casco" + dos assets já vistos).
 *  - SEMPRE buscar a versão mais nova quando houver rede (evita ver dados velhos).
 *  - NUNCA cachear as chamadas da função de sincronização (/.netlify/functions/*),
 *    senão a sincronização leria respostas congeladas.
 *
 * Versão do cache: troque CACHE a cada deploy que mude assets do casco para
 * forçar a limpeza do cache antigo. (Assets do Vite têm hash no nome, então o
 * essencial é versionar o casco/HTML.)
 * ======================================================================== */
const CACHE = "impresilk-rh-v3";

// "Casco" do app: o mínimo para abrir a interface mesmo offline.
const CASCO = ["/", "/index.html", "/favicon.png", "/apple-touch-icon.png"];

// ----- instalação: pré-carrega o casco -----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CASCO)).catch(() => {}),
  );
  // Ativa esta versão imediatamente, sem esperar abas antigas fecharem.
  self.skipWaiting();
});

// ----- ativação: remove caches de versões anteriores -----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

// ----- requisições -----
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Só tratamos GET. POST/PUT (inclusive a sincronização) passa direto.
  if (req.method !== "GET") return;

  // 2) NUNCA tocar nas funções serverless: sempre rede, sem cache.
  if (url.pathname.startsWith("/.netlify/")) return;

  // 3) Só cuidamos do nosso próprio domínio (deixa fontes/CDN externos à parte).
  if (url.origin !== self.location.origin) return;

  // 4) Network-first: tenta a rede; em sucesso, atualiza o cache; em falha
  //    (offline), entrega do cache. Para navegação (HTML), o fallback é o casco.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        // Guarda uma cópia das respostas boas para uso offline futuro.
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copia = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const cacheado = await caches.match(req);
        if (cacheado) return cacheado;
        if (req.mode === "navigate") {
          const casco = await caches.match("/index.html");
          if (casco) return casco;
        }
        return Response.error();
      }),
  );
});
