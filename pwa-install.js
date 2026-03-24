// pwa-install.js — StockFlow Pro v9.9.44
// ══════════════════════════════════════════════════════════════════
// v9.9.44 — Exibição no boot, independente de login
//
// MUDANÇAS DESTA VERSÃO
//   • tentarExibirModalInstalacao() não exige mais login (parâmetro
//     `logado` removido). Modal exibido ao abrir o app para qualquer
//     visitante que ainda não instalou o PWA.
//   • Detecção aprimorada de browsers:
//       – iOS Safari  → passos manuais com ícone ⬆ do botão Compartilhar
//       – Chrome/iOS  → aviso para abrir no Safari (CriOS no UA)
//       – Firefox/iOS → aviso para abrir no Safari (FxiOS no UA)
//       – Chrome/Edge/Firefox Android, Samsung → prompt nativo
//   • Passos iOS com ícone SVG do botão Compartilhar embutido no texto,
//     tornando as instruções inequívocas para o usuário.
//   • Variante "abrir no Safari" para Chrome/Firefox no iOS.
// ══════════════════════════════════════════════════════════════════

import { abrirComFoco, fecharComFoco } from './modal.js';

const LS_KEY_INSTALADO  = 'sf_pwa_instalado';
const LS_KEY_DESCARTADO = 'sf_pwa_descartado_em';
const DIAS_REEXIBIR     = 14;

let _deferredPrompt  = null;
let _modalEl         = null;
let _overlayEl       = null;
let _swUpdateTimer   = null;
let _capturaInited   = false;

// ── Registro do Service Worker ────────────────────────────────────

export function registrarSW() {
    if (!('serviceWorker' in navigator)) return;

    function _registrar() {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.info('[pwa] SW registrado:', reg.scope);
                _swUpdateTimer = setInterval(() => reg.update(), 60_000);
                window.addEventListener('beforeunload', () => {
                    if (_swUpdateTimer !== null) {
                        clearInterval(_swUpdateTimer);
                        _swUpdateTimer = null;
                    }
                }, { once: true });
            })
            .catch(e => console.warn('[pwa] SW não registrado:', e));
    }

    if (document.readyState === 'complete') {
        _registrar();
    } else {
        window.addEventListener('load', _registrar, { once: true });
    }
}

// ── Captura do evento de instalação ──────────────────────────────

export function iniciarCapturaPWA() {
    if (_estaEmStandalone()) return;
    if (_capturaInited) return;
    _capturaInited = true;

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        _deferredPrompt = e;
        console.info('[pwa] beforeinstallprompt capturado');
    });

    window.addEventListener('appinstalled', () => {
        console.info('[pwa] App instalado!');
        localStorage.setItem(LS_KEY_INSTALADO, '1');
        _fecharTudo(false);
    });
}

// ── Detecção de ambiente ──────────────────────────────────────────

function _detectarAmbiente() {
    const ua = navigator.userAgent;

    // FIX #7 (preservado do v9.9.42): navigator.platform é deprecated.
    // matchMedia('(hover: none) and (pointer: coarse)') detecta touch com precisão.
    // maxTouchPoints cobre iPadOS 13+ que reporta UA de desktop mas é touch.
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
                 || navigator.maxTouchPoints > 1;
    const isIOS   = isTouch && /iphone|ipad|ipod/i.test(ua);

    // Chrome no iOS (WebKit — NÃO dispara beforeinstallprompt)
    const isChromeIOS  = isIOS && /CriOS/i.test(ua);

    // Firefox no iOS (WebKit — idem)
    const isFirefoxIOS = isIOS && /FxiOS/i.test(ua);

    // Safari "puro" no iOS — único que suporta Add to Home Screen nativo.
    // Qualquer outro browser no iOS (Edge/EdgA, Opera/OPiOS, DuckDuckGo, Brave…)
    // também usa WebKit e não suporta beforeinstallprompt — isSafariIOS=false os cobre.
    const isSafariIOS  = isIOS
                       && !isChromeIOS
                       && !isFirefoxIOS
                       && /safari/i.test(ua)
                       && !/chrome|android|crios|fxios|edg[ae]|opiOS|duckduck/i.test(ua);

    return { isIOS, isChromeIOS, isFirefoxIOS, isSafariIOS };
}

// ── Lógica de exibição ────────────────────────────────────────────

/**
 * Chamado no boot do app para exibir o modal de instalação PWA.
 * Não depende de autenticação — mostra para qualquer visitante
 * que ainda não instalou o atalho.
 */
export function tentarExibirModalInstalacao() {
    if (localStorage.getItem(LS_KEY_INSTALADO)) return;
    if (_estaEmStandalone()) return;

    const descartadoEm = localStorage.getItem(LS_KEY_DESCARTADO);
    if (descartadoEm) {
        const dias = (Date.now() - parseInt(descartadoEm, 10)) / 86400000;
        if (dias < DIAS_REEXIBIR) return;
    }

    const { isIOS, isChromeIOS, isFirefoxIOS, isSafariIOS } = _detectarAmbiente();
    // BUG FIX: antes era `isChromeIOS || isFirefoxIOS`, cobrindo apenas Chrome e Firefox.
    // Edge iOS (EdgA), Opera iOS (OPiOS), Brave, DuckDuckGo e outros caíam no path de
    // `beforeinstallprompt`, que nunca chega no iOS → timeout silencioso de 30s sem modal.
    // Correto: qualquer iOS que NÃO seja Safari puro não suporta instalação.
    const isIOSNaoSafari = isIOS && !isSafariIOS;

    function _abrirQuandoVisivel(tipoModal) {
        if (document.visibilityState === 'hidden') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') _abrirModal(tipoModal);
            }, { once: true });
        } else {
            _abrirModal(tipoModal);
        }
    }

    // iOS Safari — instruções manuais nativas
    if (isSafariIOS) {
        setTimeout(() => _abrirQuandoVisivel('ios-safari'), 800);
        return;
    }

    // Chrome/Firefox no iOS — pede para abrir no Safari
    if (isIOSNaoSafari) {
        setTimeout(() => _abrirQuandoVisivel('ios-outros'), 800);
        return;
    }

    // Android Chrome, Edge, Firefox, Samsung Internet — prompt nativo
    if (_deferredPrompt) {
        setTimeout(() => _abrirQuandoVisivel('prompt'), 800);
        return;
    }

    // beforeinstallprompt ainda não chegou — aguarda 30 s
    const timerDesistir = setTimeout(() => {
        window.removeEventListener('beforeinstallprompt', _onPromptTardio);
    }, 30_000);

    function _onPromptTardio() {
        clearTimeout(timerDesistir);
        window.removeEventListener('beforeinstallprompt', _onPromptTardio);
        _abrirQuandoVisivel('prompt');
    }

    window.addEventListener('beforeinstallprompt', _onPromptTardio);
}

// ── Helpers ───────────────────────────────────────────────────────

function _estaEmStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

function _fecharTudo(descartado) {
    if (descartado) {
        localStorage.setItem(LS_KEY_DESCARTADO, String(Date.now()));
    }
    if (_modalEl) fecharComFoco(_modalEl);
    document.removeEventListener('keydown', _onEscapeKey);

    if (_modalEl) {
        _modalEl.classList.remove('pwa-modal--visivel');
        const m = _modalEl; _modalEl = null;
        setTimeout(() => m.remove(), 350);
    }
    if (_overlayEl) {
        _overlayEl.classList.remove('pwa-overlay--visivel');
        const o = _overlayEl; _overlayEl = null;
        setTimeout(() => o.remove(), 350);
    }
}

function _onEscapeKey(e) {
    if (e.key === 'Escape' && _modalEl) _fecharTudo(true);
}

// ── Criação do modal ──────────────────────────────────────────────

/**
 * @param {'prompt'|'ios-safari'|'ios-outros'} tipoModal
 */
function _abrirModal(tipoModal) {
    if (_modalEl) return;

    // Guard de segurança: se por algum motivo outro modal estiver aberto
    // (confirm, alerta), aguarda até 10s antes de desistir.
    // Na prática não ocorre pois main.js aguarda mostrarNovidades() resolver
    // (Promise que só resolve ao fechar o modal de novidades) antes de
    // chamar tentarExibirModalInstalacao().
    const _modalAberto = () => document.querySelector(
        '.modal-overlay[style*="flex"], .modal-overlay[style*="block"]'
    );
    if (_modalAberto()) {
        let tentativas = 0;
        const _aguardar = setInterval(() => {
            tentativas++;
            if (!_modalAberto() || tentativas >= 20) {
                clearInterval(_aguardar);
                if (!_modalAberto()) _abrirModal(tipoModal);
            }
        }, 500);
        return;
    }

    _overlayEl = document.createElement('div');
    _overlayEl.id = 'pwa-install-overlay';
    _overlayEl.setAttribute('aria-hidden', 'true');
    _overlayEl.addEventListener('click', () => _fecharTudo(true));
    document.body.appendChild(_overlayEl);

    _modalEl = document.createElement('div');
    _modalEl.id = 'pwa-install-modal';
    _modalEl.setAttribute('role', 'dialog');
    _modalEl.setAttribute('aria-modal', 'true');
    _modalEl.setAttribute('aria-labelledby', 'pwa-modal-titulo');
    _modalEl.setAttribute('aria-describedby', 'pwa-modal-sub');
    _construirConteudo(_modalEl, tipoModal);
    document.body.appendChild(_modalEl);

    requestAnimationFrame(() => requestAnimationFrame(() => {
        _overlayEl?.classList.add('pwa-overlay--visivel');
        _modalEl?.classList.add('pwa-modal--visivel');
        if (_modalEl) abrirComFoco(_modalEl);
    }));

    document.addEventListener('keydown', _onEscapeKey);

    _modalEl.querySelector('#pwa-btn-fechar')
        ?.addEventListener('click', () => _fecharTudo(true), { once: true });
    _modalEl.querySelector('#pwa-btn-agora-nao')
        ?.addEventListener('click', () => _fecharTudo(true), { once: true });

    if (tipoModal === 'prompt') {
        const btn = _modalEl.querySelector('#pwa-btn-instalar');
        btn?.addEventListener('click', async () => {
            if (btn.disabled) return;

            if (!_deferredPrompt) {
                const lblSpan = btn.querySelector('.pwa-btn-label');
                if (lblSpan) lblSpan.textContent = 'Aguarde o browser…';
                btn.disabled = true;
                const espera = new Promise(resolve => {
                    const t = setTimeout(() => resolve(null), 5000);
                    window.addEventListener('beforeinstallprompt', e => {
                        e.preventDefault();
                        _deferredPrompt = e;
                        clearTimeout(t);
                        resolve(e);
                    }, { once: true });
                });
                const prompt = await espera;
                if (!prompt) { _fecharTudo(true); return; }
            }

            btn.disabled = true;
            const lblSpan = btn.querySelector('.pwa-btn-label');
            if (lblSpan) lblSpan.textContent = 'Aguarde…';

            try {
                _deferredPrompt.prompt();
                const { outcome } = await _deferredPrompt.userChoice;
                _deferredPrompt = null;

                if (outcome === 'accepted') {
                    localStorage.setItem(LS_KEY_INSTALADO, '1');
                    _fecharTudo(false);
                } else {
                    _fecharTudo(true);
                }
            } catch (err) {
                console.warn('[pwa] Erro no prompt:', err);
                btn.disabled = false;
                if (lblSpan) lblSpan.textContent = 'Instalar Agora';
            }
        });
    } else {
        _modalEl.querySelector('#pwa-btn-instalar')
            ?.addEventListener('click', () => _fecharTudo(true), { once: true });
    }
}

// ── Construção do DOM ─────────────────────────────────────────────

function _construirConteudo(modal, tipoModal) {
    const topo = document.createElement('div');
    topo.className = 'pwa-modal-topo';

    const btnX = document.createElement('button');
    btnX.id = 'pwa-btn-fechar';
    btnX.className = 'pwa-btn-fechar';
    btnX.setAttribute('aria-label', 'Fechar');
    btnX.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    const icone = document.createElement('div');
    icone.className = 'pwa-modal-icone';
    icone.setAttribute('aria-hidden', 'true');
    icone.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="72" height="72"><rect width="120" height="120" rx="26" fill="#0D1B2A"/><path d="M 82 28 C 88 28,88 38,88 38 C 88 50,72 52,60 52 C 48 52,32 54,32 66 C 32 78,38 82,50 82 C 58 82,88 82,88 82" fill="none" stroke="#2979FF" stroke-width="7" stroke-linecap="round"/><circle cx="88" cy="82" r="5.5" fill="#00E5FF"/><circle cx="82" cy="28" r="3.5" fill="#2979FF" opacity="0.85"/></svg>';

    const titulo = document.createElement('h2');
    titulo.id = 'pwa-modal-titulo';
    titulo.className = 'pwa-modal-titulo';

    const sub = document.createElement('p');
    sub.id = 'pwa-modal-sub';
    sub.className = 'pwa-modal-sub';

    if (tipoModal === 'ios-safari') {
        titulo.textContent = 'Adicionar à Tela Inicial';
        sub.textContent = 'Instale o atalho em 3 passos rápidos';
    } else if (tipoModal === 'ios-outros') {
        titulo.textContent = 'Abra no Safari para Instalar';
        sub.textContent = 'O seu browser não suporta instalação direta';
    } else {
        titulo.textContent = 'Instale o StockFlow Pro!';
        sub.textContent = 'Acesse direto da tela inicial, mesmo sem internet';
    }

    topo.append(btnX, icone, titulo, sub);

    const corpo = document.createElement('div');
    corpo.className = 'pwa-modal-corpo';

    if (tipoModal === 'ios-safari') {
        _construirPassosIOSSafari(corpo);
    } else if (tipoModal === 'ios-outros') {
        _construirPassosIOSOutros(corpo);
    } else {
        _construirBeneficios(corpo);
    }

    const btnInstalar = document.createElement('button');
    btnInstalar.id = 'pwa-btn-instalar';
    btnInstalar.className = 'pwa-btn-instalar' + (tipoModal !== 'prompt' ? ' pwa-btn-instalar--ios' : '');

    if (tipoModal === 'prompt') {
        const icoSpan = document.createElement('span');
        icoSpan.setAttribute('aria-hidden', 'true');
        icoSpan.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
        const lblSpan = document.createElement('span');
        lblSpan.className = 'pwa-btn-label';
        lblSpan.textContent = 'Instalar Agora';
        btnInstalar.append(icoSpan, lblSpan);
    } else {
        btnInstalar.textContent = 'Entendido!';
    }

    const btnNao = document.createElement('button');
    btnNao.id = 'pwa-btn-agora-nao';
    btnNao.className = 'pwa-btn-agora-nao';
    btnNao.textContent = 'Agora não';

    corpo.append(btnInstalar, btnNao);
    modal.append(topo, corpo);
}

// ── Benefícios (Android / Chrome prompt) ─────────────────────────

function _construirBeneficios(corpo) {
    const beneficios = [
        {
            svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            texto: 'Acesso rápido sem abrir o navegador',
        },
        {
            svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
            texto: 'Funciona offline — sem internet',
        },
        {
            svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            texto: 'Experiência de app nativo completa',
        },
    ];
    const ul = document.createElement('ul');
    ul.className = 'pwa-beneficios';
    beneficios.forEach(({ svg, texto }) => {
        const li  = document.createElement('li');
        li.className = 'pwa-beneficio';
        const ico = document.createElement('span');
        ico.className = 'pwa-beneficio-ico';
        ico.innerHTML = svg;
        const txt = document.createElement('span');
        txt.textContent = texto;
        li.append(ico, txt);
        ul.appendChild(li);
    });
    corpo.appendChild(ul);
}

// ── iOS Safari: 3 passos com ícone Compartilhar embutido ──────────

// SVG do botão Compartilhar do Safari (caixa + seta para cima)
const _SVG_SHARE = '<svg class="pwa-share-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v13"/><polyline points="7 7 12 2 17 7"/><path d="M20 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5"/></svg>';

function _construirPassosIOSSafari(corpo) {
    const ol = document.createElement('ol');
    ol.className = 'pwa-passos-ios';

    // Passo 1: inclui ícone SVG inline no texto
    function _passo1() {
        const li  = document.createElement('li');
        li.className = 'pwa-passo';
        const num = document.createElement('span');
        num.className = 'pwa-passo-num';
        num.textContent = '1';
        const txt = document.createElement('span');
        txt.className = 'pwa-passo-txt';
        txt.appendChild(document.createTextNode('Toque no ícone '));
        const icoWrap = document.createElement('span');
        icoWrap.className = 'pwa-share-ico-wrap';
        icoWrap.innerHTML = _SVG_SHARE;
        txt.appendChild(icoWrap);
        txt.appendChild(document.createTextNode(' na barra do Safari'));
        li.append(num, txt);
        return li;
    }

    const textoPassos = [
        'Role para baixo e toque em "Adicionar à Tela de Início"',
        'Confirme tocando em "Adicionar" no canto superior direito',
    ];

    ol.appendChild(_passo1());

    textoPassos.forEach((texto, i) => {
        const li  = document.createElement('li');
        li.className = 'pwa-passo';
        const num = document.createElement('span');
        num.className = 'pwa-passo-num';
        num.textContent = String(i + 2);
        const txt = document.createElement('span');
        txt.className = 'pwa-passo-txt';
        txt.textContent = texto;
        li.append(num, txt);
        ol.appendChild(li);
    });

    corpo.appendChild(ol);
}

// ── iOS Chrome/Firefox: instruções para abrir no Safari ───────────

function _construirPassosIOSOutros(corpo) {
    const aviso = document.createElement('div');
    aviso.className = 'pwa-aviso-outros';

    const icoWrap = document.createElement('div');
    icoWrap.className = 'pwa-aviso-ico';
    icoWrap.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    const txt = document.createElement('p');
    txt.className = 'pwa-aviso-txt';
    txt.textContent = 'O StockFlow Pro só pode ser instalado pelo Safari no iPhone ou iPad.';

    const dica = document.createElement('p');
    dica.className = 'pwa-aviso-dica';
    dica.textContent = 'Copie o endereço desta página, abra no Safari e toque em Compartilhar → "Adicionar à Tela de Início".';

    aviso.append(icoWrap, txt, dica);
    corpo.appendChild(aviso);
}
