/*
 * Service worker mínimo do Ailow Cloud. Objetivo: o app ser instalável e abrir a casca sem rede.
 * REGRA DE SEGURANÇA: só atende (1) a página inicial "/" e (2) arquivos estáticos do app (/assets/, /icons/).
 * Nada da API (sessão, usuários, empresa, categorias…) passa por aqui nem vai para o cache:
 * qualquer outra requisição segue direto para a rede, como se não houvesse service worker.
 */
const CACHE = 'ailow-casca-v1';
const CASCA = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CASCA)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const pedido = event.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  const estatico = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
  const paginaInicial = pedido.mode === 'navigate' && url.pathname === '/';
  if (!estatico && !paginaInicial) return;

  if (estatico) {
    // Arquivos com hash no nome nunca mudam: cache primeiro.
    event.respondWith(
      caches.match(pedido).then(
        (guardado) =>
          guardado ||
          fetch(pedido).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone();
              caches.open(CACHE).then((cache) => cache.put(pedido, copia));
            }
            return resposta;
          }),
      ),
    );
    return;
  }

  // Página inicial: rede primeiro (versão nova sempre que houver internet), casca guardada se estiver offline.
  event.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copia));
        }
        return resposta;
      })
      .catch(() => caches.match('/').then((guardado) => guardado || Response.error())),
  );
});
