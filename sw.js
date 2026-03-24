// sw.js — StockFlow Pro Service Worker v9.9.46
// ══════════════════════════════════════════════════════════════════
// v9.9.6  — ASSETS gerado automaticamente por generate-sw.js
// v9.9.39 — estoques.js adicionado à lista ASSETS
// v9.9.40 — Correção Pull-to-refresh
// v9.9.41 — Correções de auditoria técnica
//   [ALTO] firebase.vite.js removido do ASSETS (só existe em dev Vite)
//   PROBLEMA: novo módulo estoques.js não estava na lista de cache
//   → funcionalidade de multi-estoque quebrava offline.
//   CORREÇÃO: './estoques.js' adicionado ao bloco Módulos principais.
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES HISTÓRICAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — fetch handler sem tratamento de erro de rede
// BUG #2 — Respostas opacas (cross-origin) eram cacheadas
// BUG #3 — install: sem tratamento de falha parcial de cache
// BUG #4 — VERSION inconsistente com o comentário do cabeçalho
// BUG #5 — ft-preparo.js ausente da lista de ASSETS
// BUG #6 — Assets v9.8.x ausentes da lista de ASSETS
// BUG #7 — Firebase interceptado pelo fallback de rede offline
// BUG #8 — url não declarada no escopo do fetch handler
// ══════════════════════════════════════════════════════════════════

// v9.9.46 — Ficha Técnica no sidebar (accordion) + 5 correções de auditoria
const VERSION    = '9.9.48';
const CACHE_NAME = 'stockflow-v' + VERSION.replace(/\./g, '-');

const ASSETS = [
    './',
    // ── App shell ─────────────────────────────────────────
    // CHANGELOG.md: conteúdo das novidades agora é hardcoded em main.js —
    // não há mais fetch('./CHANGELOG.md'). Mantido fora do ASSETS por precaução.
    './fundo-pizza.jpg',
    './icone-192.png',
    './icone-512.png',
    './icone-maskable.png',
    './icone.png',
    './index.html',
    './manifest.json',
    './stockflow-logo.svg',
    // ── CSS ───────────────────────────────────────────────
    './ai-style.css',
    './apple-overrides.css',
    './bg-upload.css',
    './ft-style.css',
    './massa-extra.css',
    './patch-v976.css',
    './patch-v980.css',
    './patch-v985.css',
    './style.css',
    // ── Módulos principais ────────────────────────────────
    './ai-groq.js',
    './ai-ui.js',
    './alerta.js',
    './auth.js',
    './bg-upload.js',
    './calculadora.js',
    './calendario.js',
    './categorias.js',
    './compras.js',
    './confirm.js',
    './dropdown.js',
    './estoques.js',
    './eventos.js',
    './export.js',
    './expr.js',
    './firebase.js',
    // FIX ALTO: './firebase.vite.js' removido — arquivo só existe no ambiente
    // Vite/dev; em produção (GitHub Pages) causa 404 no install do SW.
    './idb.js',
    './listafacil.js',
    './main.js',
    './massa.js',
    './modal.js',
    './navegacao.js',
    './parser.js',
    './producao.js',
    './pullrefresh.js',
    './pwa-install.js',
    './pwa-install.css',
    './produtos.js',
    './reload.js',
    './search.js',
    './storage.js',
    './store.js',
    './swipe.js',
    './tabela.js',
    './teclado.js',
    './theme.js',
    './toast.js',
    './ui.js',
    './utils.js',
    // ── Ficha Técnica ─────────────────────────────────────
    './ficha-tecnica.html',
    './ft-app.js',
    './ft-calc.js',
    './ft-custos.js',
    './ft-dashboard.js',
    './ft-exportacao.js',
    './ft-firebase.js',
    './ft-format.js',
    './ft-icons.js',
    './ft-ingredientes.js',
    './ft-preparo.js',
    './ft-receitas.js',
    './ft-storage.js',
    './ft-ui.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            const results = await Promise.allSettled(
                ASSETS.map(url =>
                    fetch(url).then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
                        return cache.put(url, res);
                    })
                )
            );
            const falhos = results.filter(r => r.status === 'rejected');
            if (falhos.length) {
                console.warn(`[SW] ${falhos.length} asset(s) não cacheados:`,
                    falhos.map(f => f.reason?.message || f.reason));
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    const url = e.request.url;

    const isFirebase = url.includes('firebaseio.com') ||
                       url.includes('firestore.googleapis.com') ||
                       url.includes('firebase.googleapis.com') ||
                       url.includes('identitytoolkit.googleapis.com') ||
                       url.includes('gstatic.com/firebasejs');
    if (isFirebase) return;

    // CHANGELOG.md: excluído do cache por precaução (conteúdo hardcoded em main.js).
    // mostrarNovidades() usa { cache: 'no-store' } mas o SW interceptaria
    // de qualquer forma sem este guard.
    if (url.endsWith('/CHANGELOG.md') || url.endsWith('CHANGELOG.md')) return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request)
                .then(response => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match('./index.html').then(fallback =>
                        fallback || new Response('Sem conexão e sem cache disponível.', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                        })
                    );
                });
        })
    );
});
