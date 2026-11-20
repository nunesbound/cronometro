// Cronômetro de Laudos — deixa o site abrir mesmo sem internet.
// Sempre tenta a versão mais nova primeiro; se a rede falhar (ou demorar mais de 4 s),
// abre a última versão guardada. Não guarda nada do Google (planilha, fontes) nem o acesso.json.
// Seus laudos não passam por aqui: eles ficam no navegador e na sua planilha.
const CACHE = 'cronometro-laudos-v1';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    ARQUIVOS.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.indexOf('cronometro-laudos') === 0).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // Google: sempre direto
  if (/\/acesso\.json$/.test(url.pathname)) return;    // sempre da rede
  e.respondWith(primeiroRede(req));
});

function guardado(req){
  return caches.match(req, { ignoreSearch: true }).then((r) => {
    if (r || req.mode !== 'navigate') return r;
    return caches.match('./').then((x) => x || caches.match('./index.html'));
  });
}

function primeiroRede(req){
  return new Promise((resolve) => {
    let respondeu = false;
    const responder = (r) => { if (!respondeu && r){ respondeu = true; resolve(r); } };
    // rede lenta: depois de 4 s, abre a versão guardada (a nova continua chegando e fica para a próxima vez)
    const espera = setTimeout(() => { guardado(req).then(responder); }, 4000);
    const pedido = req.mode === 'navigate' ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req;
    fetch(pedido).then((res) => {
      clearTimeout(espera);
      if (res && res.ok && res.type === 'basic'){
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      responder(res);
    }).catch(() => {
      clearTimeout(espera);
      guardado(req).then((r) => {
        if (r) responder(r);
        else if (!respondeu){ respondeu = true; resolve(Response.error()); }
      });
    });
  });
}
