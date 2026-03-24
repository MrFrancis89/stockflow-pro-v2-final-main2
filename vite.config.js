// vite.config.js — StockFlow Pro v9.9.6
// ══════════════════════════════════════════════════════════════════
// Sistema de build com Vite + vite-plugin-pwa.
//
// O QUE MUDA COM VITE:
//   • firebase.js: imports CDN viram imports de pacote:
//       'firebase/app', 'firebase/firestore', 'firebase/auth'
//     (Vite resolve automaticamente via node_modules)
//   • Service Worker: gerado pelo plugin PWA (substitui generate-sw.js)
//   • CSS e JS: minificados e com hash no nome (long-term cache)
//   • Tree-shaking automático — só o código usado vai para o bundle
//
// ESTRUTURA DE BUILD:
//   dist/
//     index.html              ← HTML com hashes
//     assets/main.[hash].js   ← bundle principal minificado
//     assets/style.[hash].css ← CSS minificado
//     sw.js                   ← Service Worker gerado pelo plugin
//
// COMANDOS:
//   npm install       → instala dependências (uma vez)
//   npm run dev       → servidor de desenvolvimento com HMR
//   npm run build     → gera dist/ para deploy
//   npm run preview   → testa o build de produção localmente
// ══════════════════════════════════════════════════════════════════

import { defineConfig } from 'vite';
import { VitePWA }      from 'vite-plugin-pwa';

export default defineConfig({
    // Raiz do projeto — todos os arquivos estão na mesma pasta
    root: '.',

    build: {
        outDir:    'dist',
        emptyOutDir: true,
        // Chunk splitting: Firebase em chunk separado para cache eficiente
        rollupOptions: {
            output: {
                manualChunks: {
                    firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
                },
            },
        },
    },

    // PWA — gera sw.js e manifest automaticamente
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',

            // Configuração do Service Worker gerado
            workbox: {
                // Cacheia todos os assets do build + arquivos estáticos
                globPatterns: ['**/*.{js,css,html,json,png,jpg,svg,md}'],

                // Não cacheia o Firebase CDN — requisições passam direto
                navigateFallback: 'index.html',
                navigateFallbackDenylist: [
                    /firebaseio\.com/,
                    /firestore\.googleapis\.com/,
                    /firebase\.googleapis\.com/,
                    /identitytoolkit\.googleapis\.com/,
                    /gstatic\.com\/firebasejs/,
                ],
            },

            // Manifest lido do manifest.json existente
            manifest: false,
            manifestFilename: 'manifest.json',

            // Sem injeção automática de registro — main.js já registra o SW
            injectRegister: null,
        }),
    ],

    // Otimização de dependências: pré-bundla Firebase no dev
    optimizeDeps: {
        include: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
    },

    // Servidor de desenvolvimento
    server: {
        port:  5173,
        open:  true,
        // HTTPS opcional — necessário para testar Service Worker no dev
        // https: true,
    },

    // ── Vitest (#21) ──────────────────────────────────────────────
    test: {
        environment: 'happy-dom',
        include:     ['tests/**/*.test.js'],
        reporters:   ['verbose'],
    },
});
