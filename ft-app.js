// ft-app.js — StockFlow Pro V2
// V2: adicionado Modo Negócio (ft-negocio.js), Cardápio (ft-cardapio.js), Tamanhos (ft-tamanhos.js)
import { initFirebase, fbGetCurrentUser, fbSignInGoogle,
         fbSignOut, fbIsAvailable, fbGetUser }             from './ft-firebase.js';
import { sincronizarLocalParaFirebase }                    from './ft-storage.js';
import { initModalOverlay, setLoading, toast, debounce, initRipple, renderSkeleton } from './ft-ui.js';
import { initIngredientes, renderIngredientes,
         abrirFormIngrediente }                            from './ft-ingredientes.js';
import { initReceitas, renderReceitas, abrirFormReceita } from './ft-receitas.js';
import { initSimulador,  renderSimulador }                from './ft-custos.js';
import { renderDashboard }                                from './ft-dashboard.js';
import { renderExportacao }                               from './ft-exportacao.js';
import { initPreparo, renderPreparo, abrirFormPreparo }   from './ft-preparo.js';
import { initGastos, renderGastos, abrirFormGasto }       from './ft-gastos.js';
import { initPrecifica, renderPrecifica }                 from './ft-precifica.js';
import { initNegocio, renderNegocio }                     from './ft-negocio.js';
import { initCardapio, renderCardapio }                   from './ft-cardapio.js';
import { initTamanhos, renderTamanhos }                   from './ft-tamanhos.js';
import { ico }                                            from './ft-icons.js';
import { esc }                                            from './ft-format.js';

let _aba = 'ing';
let _pendingTab = null; // tab solicitada via postMessage antes do app estar pronto

// ── Tema ──────────────────────────────────────────────────────────
const TEMA_CSS = {
    escuro:   [],
    midnight: ['theme-midnight'],
    arctic:   ['theme-arctic', 'light-mode'],
    forest:   ['theme-forest'],
};
function _aplicarTema(tema) {
    const body = document.body;
    ['theme-midnight','theme-arctic','theme-forest','light-mode'].forEach(c => body.classList.remove(c));
    (TEMA_CSS[tema] || []).forEach(c => body.classList.add(c));
}
function _initTema() {
    // ── 1. ANTI-FOUC: aplica tema IMEDIATAMENTE via localStorage ────────────
    // Esta chamada síncrona acontece antes de qualquer render, eliminando
    // o flash de cor errada. O valor já está no localStorage porque
    // main.js chama salvarTema() antes de qualquer interação do usuário.
    _aplicarTema(localStorage.getItem('temaEstoque') || 'escuro');

    // ── 2. FALLBACK: storage event (mesma origin, outras abas/janelas) ───────
    // Mantido como segurança extra para cenários multi-janela, mas NÃO dispara
    // na mesma página que fez a escrita — por isso não é suficiente sozinho.
    window.addEventListener('storage', e => {
        if (e.key === 'temaEstoque') _aplicarTema(e.newValue || 'escuro');
    });

    // ── 3. PRIMÁRIO: postMessage do app pai via Cross-Document Messaging ─────
    // Recebe { type: 'SF_TEMA', tema } enviado por main.js sempre que o
    // usuário troca o tema. Entrega imediata, zero delay, mesma frame de render.
    // Recebe também { type: 'SF_FT_NAV', tab } para troca de aba via sidebar.
    window.addEventListener('message', e => {
        // Valida origem: aceita apenas mensagens do parent (mesma origin).
        // Usa e.origin === window.location.origin para validação estrita
        // em vez de apenas e.source, protegendo contra ataques de origem cruzada.
        if (e.source !== window.parent) return;
        if (e.origin !== window.location.origin) return;
        if (!e.data || typeof e.data.type !== 'string') return;
        if (e.data.type === 'SF_SIDEBAR_STATE') {
            const btn = document.getElementById('ft-btn-sidebar');
            if (btn) btn.setAttribute('aria-expanded', e.data.open ? 'true' : 'false');
        }
        if (e.data.type === 'SF_TEMA') {
            if (typeof e.data.tema !== 'string') return;
            _aplicarTema(e.data.tema);
        }
        if (e.data.type === 'SF_FT_NAV') {
            const validTabs = ['ing','rec','sim','dash','exp','pre','gas','prec','neg','car','tam'];
            if (validTabs.includes(e.data.tab)) {
                // Se o app ainda não está pronto, guarda o tab pendente
                if (document.getElementById('ft-app')?.classList.contains('hidden')) {
                    _pendingTab = e.data.tab;
                } else {
                    _navTo(e.data.tab);
                }
            }
        }
    });

    // REMOVIDO (FIX BAIXO): listener 'ft-tema' era código morto — nenhum módulo
    // dispara este CustomEvent. theme.js usa postMessage; window.storage cobre
    // mudanças de tema. Listener removido para não acumular em window.
}

// ── Tela de Login ─────────────────────────────────────────────────
function _mostrarLogin(erro = '') {
    setLoading(false);
    const wrap = document.getElementById('ft-login');
    if (!wrap) return;
    wrap.innerHTML = `
        <div class="ft-login-box">
            <div class="ft-login-logo">&#x1F355;</div>
            <h1 class="ft-login-title">Ficha Técnica</h1>
            <p class="ft-login-sub">Faça login para sincronizar seus dados<br>em qualquer dispositivo.</p>
            ${erro ? `<div class="ft-login-erro">${erro}</div>` : ''}
            <button class="ft-login-btn" id="ft-btn-google">
                <svg class="ft-google-ico" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Entrar com Google</span>
            </button>
            <p class="ft-login-hint">Seus dados ficam salvos na sua conta Google.<br>Funciona em qualquer dispositivo.</p>
        </div>`;
    wrap.classList.remove('hidden');

    document.getElementById('ft-btn-google')?.addEventListener('click', async () => {
        const btn = document.getElementById('ft-btn-google');
        if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Aguarde…'; }
        try {
            await fbSignInGoogle();
            wrap.classList.add('hidden');
            await _initApp();
        } catch (e) {
            console.error('[login]', e);
            const msg = e.code === 'auth/popup-closed-by-user'
                ? 'Login cancelado.'
                : e.code === 'auth/popup-blocked'
                ? 'Popup bloqueado. Permita popups para este site.'
                : 'Falha ao entrar. Tente novamente.';
            _mostrarLogin(msg);
        }
    });
}

// ── Init do app (após login) ───────────────────────────────────────
async function _initApp() {
    setLoading(true);
    document.getElementById('ft-app')?.classList.remove('hidden');

    try {
        const user = fbGetUser();
        if (user) {
            _atualizarHeaderUser(user);
            await sincronizarLocalParaFirebase();
            _setBadge(true);
        } else {
            _setBadge(false);
        }

        // Skeleton enquanto os dados carregam do Firebase / localStorage
        _mostrarSkeletons();

        await initTamanhos(); // GAP 5 — deve iniciar ANTES de initReceitas
        await initCardapio(); // GAP 8 — no-op mas garante import utilizado
        await Promise.all([
            initIngredientes(),
            initReceitas(),
            initSimulador(),
            initPreparo(),
            initGastos(),
            initNegocio(),
            initPrecifica(),
        ]);

        _navTo('ing');
    } catch (e) {
        console.error('[ft-app] init error:', e);
        toast('Erro ao inicializar. Modo offline ativo.', 'aviso');
        _navTo('ing');
    }

    setLoading(false);
    document.dispatchEvent(new CustomEvent('ft:appReady'));
    // Aplica tab pendente — prioridade: localStorage (sidebar) > postMessage
    const _lsTab = (() => { try { const t = localStorage.getItem('sidebarFtPendingTab'); localStorage.removeItem('sidebarFtPendingTab'); return t; } catch(e) { return null; } })();
    if (_lsTab) { _navTo(_lsTab); } else if (_pendingTab) { _navTo(_pendingTab); _pendingTab = null; }
}

// ── Skeleton pre-render (UX premium v10.0) ───────────────────────
// Exibe placeholders animados enquanto os dados carregam do Firebase/LS.
// Chamada antes de Promise.all([initIngredientes, ...]) nos 3 caminhos de boot.
// _navTo() sobrescreve com o conteúdo real assim que os dados estão prontos.
function _mostrarSkeletons() {
    const CONTAINERS = [
        { id: 'ft-lista-ing',  tipo: 'row',  n: 4 },
        { id: 'ft-lista-rec',  tipo: 'row',  n: 3 },
        { id: 'ft-simulador',  tipo: 'card', n: 2 },
        { id: 'ft-preparo',    tipo: 'row',  n: 3 },
    ];
    CONTAINERS.forEach(({ id, tipo, n }) => {
        const el = document.getElementById(id);
        if (el) renderSkeleton(el, n, tipo);
    });
}

// Avatar + nome do usuário no header
function _atualizarHeaderUser(user) {
    const btn = document.getElementById('ft-user-btn');
    if (!btn) return;
    const foto = user.photoURL;
    const nome = user.displayName || user.email || 'Usuário';
    btn.innerHTML = foto
        ? `<img src="${esc(foto)}" alt="${esc(nome)}" class="ft-avatar">`
        : `<span class="ft-avatar-ini">${esc(nome.charAt(0).toUpperCase())}</span>`;
    btn.title = nome;
    btn.style.display = 'flex';
}

// ── Boot ──────────────────────────────────────────────────────────
async function init() {
    setLoading(true);
    _initTema();

    const sdkOk = await Promise.race([
        initFirebase(),
        new Promise(r => setTimeout(() => r(false), 6000)),
    ]);

    if (!sdkOk) {
        // Firebase indisponível — usa modo offline direto
        // FIX #1: ocultar ft-login explicitamente; sem isso ele sobrepõe ft-app
        //         e a tela fica branca mesmo com o app inicializado.
        document.getElementById('ft-login')?.classList.add('hidden');
        document.getElementById('ft-app')?.classList.remove('hidden');
        _setBadge(false);
        setLoading(false);
        // FIX #2: try/catch ausente — qualquer erro nos init* deixava a tela
        //         branca sem nenhuma mensagem de fallback ao usuário.
        try {
            _mostrarSkeletons();
            await initTamanhos(); await Promise.all([initIngredientes(), initReceitas(), initSimulador(), initPreparo(), initGastos(), initPrecifica(), initNegocio()]);
        } catch (e) {
            console.error('[ft-app] init offline error:', e);
            toast('Erro ao carregar dados offline.', 'aviso');
        }
        const _lsTabOff = (() => { try { const t = localStorage.getItem('sidebarFtPendingTab'); localStorage.removeItem('sidebarFtPendingTab'); return t; } catch(e) { return null; } })();
        if (_lsTabOff) { _navTo(_lsTabOff); } else if (_pendingTab) { _navTo(_pendingTab); _pendingTab = null; } else { _navTo('ing'); }
        document.dispatchEvent(new CustomEvent('ft:appReady'));
        return;
    }

    // Verifica sessão existente
    const user = await fbGetCurrentUser();
    setLoading(false);

    if (user) {
        // Já logado — inicia o app
        document.getElementById('ft-login')?.classList.add('hidden');
        await _initApp();
    } else {
        // Não logado — mostra tela de login
        document.getElementById('ft-app')?.classList.add('hidden');
        _mostrarLogin();
    }
}

// ── Navegação ─────────────────────────────────────────────────────
function _navTo(aba) {
    _aba = aba;
    document.querySelectorAll('.ft-section').forEach(s =>
        s.classList.toggle('active', s.id === `ft-sec-${aba}`));
    document.querySelectorAll('.ft-nav-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === aba));
    const fab = document.getElementById('ft-fab');
    if (fab) fab.style.display = ['ing','rec','pre','gas'].includes(aba) ? 'flex' : 'none';
    switch (aba) {
        case 'ing':  renderIngredientes(); break;
        case 'rec':  renderReceitas();     break;
        case 'sim':  renderSimulador();    break;
        case 'dash': renderDashboard();    break;
        case 'exp':  renderExportacao();   break;
        case 'pre':  renderPreparo();      break;
        case 'gas':  renderGastos();       break;
        case 'prec': renderPrecifica();    break;
        case 'neg':  renderNegocio();      break;
        case 'car':  renderCardapio();     break;
        case 'tam':  renderTamanhos('ft-tamanhos'); break;
    }
}

function _fab() {
    if (_aba === 'ing') abrirFormIngrediente();
    if (_aba === 'rec') abrirFormReceita();
    if (_aba === 'pre') abrirFormPreparo();
    if (_aba === 'gas') abrirFormGasto();
}

function _setBadge(online) {
    const b = document.getElementById('ft-sync-btn');
    if (!b) return;
    b.innerHTML = online ? ico.cloud : ico.cloudOff;
    b.title     = online ? 'Firebase conectado' : 'Modo offline';
    b.classList.toggle('online', online);
}

// ── Listeners ─────────────────────────────────────────────────────
function _listeners() {
    // ── BOTÃO HAMBÚRGUER — abre a sidebar no app pai ─────────────────────────
    // Envia SF_OPEN_SIDEBAR ao frame pai (main.js), que chama abrirSidebar().
    const btnHamburger = document.getElementById('ft-btn-sidebar');
    if (btnHamburger) {
        btnHamburger.addEventListener('click', () => {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(
                    { type: 'SF_OPEN_SIDEBAR' },
                    window.location.origin
                );
            }
        });
    }

    document.querySelectorAll('.ft-nav-btn').forEach(b =>
        b.addEventListener('click', () => _navTo(b.dataset.tab)));

    document.getElementById('ft-fab')?.addEventListener('click', _fab);

    const b1 = document.getElementById('ft-busca-ing');
    const b2 = document.getElementById('ft-busca-rec');
    const b3 = document.getElementById('ft-busca-pre');
    if (b1) b1.addEventListener('input', debounce(e => renderIngredientes(e.target.value)));
    if (b2) b2.addEventListener('input', debounce(e => renderReceitas(e.target.value)));
    if (b3) b3.addEventListener('input', debounce(e => renderPreparo(e.target.value)));

    document.getElementById('ft-sync-btn')?.addEventListener('click', async () => {
        if (!fbIsAvailable()) { toast('Firebase não disponível.', 'aviso'); return; }
        setLoading(true);
        await sincronizarLocalParaFirebase();
        setLoading(false);
        toast('Dados sincronizados!', 'sucesso');
    });

    // Botão de logout / perfil
    document.getElementById('ft-user-btn')?.addEventListener('click', async () => {
        const user = fbGetUser();
        if (!user) return;
        const nome = user.displayName || user.email || 'Usuário';
        // Confirm logout
        const ok = await import('./ft-ui.js').then(m =>
            m.confirmar(`<strong>${esc(nome)}</strong><br>Deseja sair da conta?`, { labelOK: 'Sair' })
        );
        if (!ok) return;
        await fbSignOut();
        document.getElementById('ft-app')?.classList.add('hidden');
        _mostrarLogin();
    });

    document.addEventListener('ft:recs-changed', () => {
        if (_aba === 'sim')  renderSimulador();
        if (_aba === 'dash') renderDashboard();
    });
    document.addEventListener('ft:ings-changed', () => {
        if (_aba === 'dash') renderDashboard();
    });

    initModalOverlay();
    initRipple();

    // Safety-net: acionado pelo timeout de ficha-tecnica.html se o app travar
    document.addEventListener('ft:forceOffline', async () => {
        const loading = document.getElementById('ft-loading');
        if (loading) loading.style.display = 'none';
        document.getElementById('ft-login')?.classList.add('hidden');
        document.getElementById('ft-app')?.classList.remove('hidden');
        _setBadge(false);
        try {
            _mostrarSkeletons();
            await initTamanhos(); await Promise.all([initIngredientes(), initReceitas(), initSimulador(), initPreparo(), initGastos(), initPrecifica(), initNegocio()]);
        } catch (e) {
            console.warn('[ft-app] forceOffline init error:', e);
        }
        const _lsTabForce = (() => { try { const t = localStorage.getItem('sidebarFtPendingTab'); localStorage.removeItem('sidebarFtPendingTab'); return t; } catch(e) { return null; } })();
        if (_lsTabForce) { _navTo(_lsTabForce); } else if (_pendingTab) { _navTo(_pendingTab); _pendingTab = null; } else { _navTo('ing'); }
        document.dispatchEvent(new CustomEvent('ft:appReady'));
    }, { once: true });
}

document.addEventListener('DOMContentLoaded', () => { _listeners(); init(); });
